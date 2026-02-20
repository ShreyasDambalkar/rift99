from fastapi import FastAPI, File, UploadFile, HTTPException, status, Form, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
import logging
import io
import uuid
import datetime
from variant_extractor import extract_variants
from diplotype_builder import build_diplotype
from phenotype_engine import get_phenotype
from drug_risk_engine import predict_drug_risks
from pydantic import BaseModel
import sys
import os
# ReportLab Imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from fastapi.responses import StreamingResponse

# Load .env file for SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional — env vars can be set directly

# Import ML features
try:
    from vcf_feature_extractor.extractor import VCFFeatureExtractor
    HAS_ML = True
except ImportError:
    HAS_ML = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize ML Extractor if available
ml_extractor = None
if HAS_ML:
    model_dir = os.path.join(os.path.dirname(__file__), "vcf_feature_extractor", "models")
    ml_extractor = VCFFeatureExtractor(model_dir=model_dir)
    ml_extractor.load_model()

# ── WebSocket Connection Manager ──────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # user_id -> websocket

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"[Chat] User {user_id} connected")

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
        logger.info(f"[Chat] User {user_id} disconnected")

    async def send_to_user(self, user_id: str, data: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(user_id)

chat_manager = ConnectionManager()

# ── Supabase helper (uses env vars) ────────────────────────────────────
def get_supabase_headers():
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_ANON_KEY", ""))
    return url, {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

app = FastAPI(title="PharmaGuard VCF Authenticator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TARGET_GENES = {"CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"}
# Required tags that MUST be present in the INFO field for Pharmacogene entries
REQUIRED_TAGS = {"GENE", "RS", "STAR"}

MAX_FILE_SIZE = 5 * 1024 * 1024 # 5MB
MIN_FILE_SIZE = 1 * 1024 # 1KB


@app.get("/", response_class=HTMLResponse)
async def main():
    content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PharmaGuard Local Analysis</title>
    <style>
        :root {
            --primary: #0ea5e9;
            --primary-dark: #0284c7;
            --success: #22c55e;
            --error: #ef4444;
            --bg: #0f172a;
            --card-bg: #1e293b;
            --text: #f8fafc;
            --text-muted: #94a3b8;
        }
        body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 2rem;
        }
        .container {
            width: 100%;
            max-width: 800px;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }
        .card {
            background-color: var(--card-bg);
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255,255,255,0.05);
        }
        h1 {
            text-align: center;
            background: linear-gradient(to right, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0 0 0.5rem 0;
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--text-muted);
            font-size: 0.9rem;
        }
        input[type="text"] {
            width: 100%;
            padding: 0.75rem;
            background: rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 0.5rem;
            color: white;
            box-sizing: border-box;
        }
        input[type="file"] {
            width: 100%;
            padding: 0.5rem;
            background: rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 0.5rem;
            color: var(--text-muted);
            box-sizing: border-box;
        }
        button {
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
        }
        button:hover {
            background-color: var(--primary-dark);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .result-card {
            background: rgba(255,255,255,0.03);
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 1rem;
            border-left: 4px solid var(--text-muted);
        }
        .result-card.risk-Toxic, .result-card.severity-high { border-left-color: #ef4444; }
        .result-card.risk-Ineffective { border-left-color: #fbbf24; }
        .result-card.risk-Safe { border-left-color: #22c55e; }
        
        pre {
            background: #000;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            color: #a5f3fc;
            font-size: 0.85rem;
            max-height: 400px;
            overflow-y: auto;
        }
        .copy-btn {
            background: rgba(255,255,255,0.1);
            margin-top: 0.5rem;
            width: auto;
            font-size: 0.8rem;
            padding: 0.5rem 1rem;
        }
        .hidden { display: none; }
        .spinner {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 0.5rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>PharmaGuard Local</h1>
            <p style="text-align: center; color: var(--text-muted);">Secure Pharmacogenomic Analysis</p>
            
            <form id="analyzeForm">
                <div class="form-group">
                    <label>1. Upload VCF File (v4.2)</label>
                    <input type="file" id="vcfFile" accept=".vcf" required>
                </div>
                
                <div class="form-group">
                    <label>2. Enter Drugs (comma-separated)</label>
                    <input type="text" id="drugs" value="Codeine, Warfarin, Clopidogrel, Simvastatin" required>
                </div>
                
                <button type="submit" id="submitBtn">
                    <span id="btnText">Run Analysis</span>
                </button>
            </form>
        </div>

        <div id="resultsArea" class="hidden">
            <!-- Visual Results -->
            <div class="card">
                <h2 style="margin-top:0;">Clinical Insights</h2>
                <div id="cardsContainer"></div>
            </div>
            
            <!-- JSON Output -->
            <div class="card">
                <h2 style="margin-top:0;">Evaluation JSON Outcome</h2>
                <div style="position: relative;">
                    <pre id="jsonOutput"></pre>
                </div>
                <button class="copy-btn" onclick="copyJson()">📋 Copy JSON for Submission</button>
            </div>
        </div>
    </div>

    <script>
        const form = document.getElementById('analyzeForm');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const resultsArea = document.getElementById('resultsArea');
        const cardsContainer = document.getElementById('cardsContainer');
        const jsonOutput = document.getElementById('jsonOutput');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // UI Loading
            submitBtn.disabled = true;
            btnText.innerHTML = '<div class="spinner"></div> Processing...';
            resultsArea.classList.add('hidden');
            
            const file = document.getElementById('vcfFile').files[0];
            const drugs = document.getElementById('drugs').value;
            
            const formData = new FormData();
            formData.append('vcf_file', file);
            formData.append('drugs', drugs);

            try {
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    renderResults(data.results);
                    jsonOutput.textContent = JSON.stringify(data, null, 2);
                    resultsArea.classList.remove('hidden');
                } else {
                    alert('Error: ' + (data.error || 'Analysis failed'));
                }
                
            } catch (err) {
                alert('Network Error: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                btnText.textContent = 'Run Analysis';
            }
        });

        function renderResults(results) {
            cardsContainer.innerHTML = '';
            results.forEach(item => {
                const risk = item.risk_assessment;
                const profile = item.pharmacogenomic_profile;
                const explanation = item.llm_generated_explanation.summary;
                
                let severityClass = 'severity-' + risk.severity;
                let riskClass = 'risk-' + risk.risk_label.replace(/\\s+/g, '');
                
                const div = document.createElement('div');
                div.className = `result-card ${riskClass} ${severityClass}`;
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <strong style="font-size:1.1rem; color:white;">${item.drug}</strong>
                        <span style="background:rgba(255,255,255,0.1); padding:0.2rem 0.5rem; border-radius:0.3rem; font-size:0.8rem;">
                            ${profile.primary_gene} ${profile.phenotype} (${profile.diplotype})
                        </span>
                    </div>
                    <div style="font-weight:bold; margin-bottom:0.5rem; font-size:1.05rem;">
                        ${risk.risk_label} <span style="font-weight:normal; opacity:0.7;">(Confidence: ${risk.confidence_score})</span>
                    </div>
                    <div style="color:var(--text-muted); font-size:0.9rem; line-height:1.4;">
                        ${explanation}
                    </div>
                `;
                cardsContainer.appendChild(div);
            });
        }

        function copyJson() {
            const text = jsonOutput.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.querySelector('.copy-btn');
                const orig = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => btn.textContent = orig, 2000);
            });
        }
    </script>
</body>
</html>
    """
    return HTMLResponse(content=content)
    
class RiskRequest(BaseModel):

    drug_names: str
    phenotype_profile: dict

@app.post("/predict-risk")
async def predict_risk(req: RiskRequest):
    return predict_drug_risks(req.drug_names, req.phenotype_profile)


EXPLANATION_RULES = {
    "CODEINE_PM": "Codeine requires CYP2D6 activation. Poor metabolizers cannot convert codeine into morphine, leading to ineffective pain relief.",
    "CLOPIDOGREL_PM": "Clopidogrel requires CYP2C19 activation. Poor metabolizers cannot activate the drug, increasing cardiovascular event risk.",
    "WARFARIN_PM": "Reduced CYP2C9 metabolism increases warfarin levels and bleeding risk.",
    "SIMVASTATIN_LOW": "Reduced SLCO1B1 transport increases statin accumulation and myopathy risk.",
    "TPMT_PM": "Low TPMT activity causes accumulation of thiopurines leading to bone marrow toxicity.",
    "DPYD_PM": "DPYD deficiency prevents fluorouracil breakdown causing life-threatening toxicity",
    "DEFAULT": "Genetic variants influence drug metabolism and may require dose adjustment."
}

class AnalyzeRequest(BaseModel):
    # This is for form data documentation, but actual parsing happens via Form(...)
    pass

from response_formatter import format_analysis_result
from explanation_templates import get_explanation

@app.post("/api/analyze")
async def analyze_vcf(
    vcf_file: UploadFile = File(...),
    drugs:str = Form(...)
):
    try:
        # 1. Processing Pipeline: Validate & Profile
        vcf_result = await process_vcf_file(vcf_file)
        
        if not vcf_result.get("valid"):
            logger.error(f"VCF Validation Failed: {vcf_result}")
            return JSONResponse(
                status_code=vcf_result.get("status_code", status.HTTP_400_BAD_REQUEST),
                content={
                    "error": "VCF Validation Failed", 
                    "message": vcf_result.get("message", "Unknown validation error"),
                    "details": vcf_result
                }
            )
            
        genetic_profile = vcf_result.get("genetic_profile", {})
        
        # 2. Risk Prediction
        simple_profile = {gene: data["phenotype"] for gene, data in genetic_profile.items()}
        risk_assessments = predict_drug_risks(drugs, simple_profile)
        
        # 3. Generate Explanations
        explanations_map = {}
        for assessment in risk_assessments:
            drug_name = assessment["drug"]
            gene = assessment["primary_gene"]
            pheno = assessment["phenotype"]
            
            import os
            api_key = os.getenv("GROQ_API_KEY", "")
            
            explanations_map[drug_name] = get_explanation(drug_name, gene, pheno, api_key)

    
        # 4. Final Data Collection
        # Since we cannot change the schema of formatted_results easily without breaking things, 
        # we will add a 'supplemental_ml_info' key to each result at the end.
        final_response = format_analysis_result(vcf_result, risk_assessments, explanations_map)
        
        # 5. Add ML Insights if available
        if ml_extractor:
            try:
                # We need the VCF content as string for the ML extractor
                # vcf_file was already read in process_vcf_file, so we might need to seek(0)?
                # Actually, process_vcf_file already extracted lines if valid.
                # But ML extractor takes a string.
                # Let's just re-read the file content once more or use the stored lines.
                # Wait, process_vcf_file returns valid_lines_for_profiling? No, it's local.
                # Let's just re-read the file content from the UploadFile object (it's in memory usually or we can seek).
                await vcf_file.seek(0)
                vcf_content = (await vcf_file.read()).decode("utf-16le" if "utf-16le" in str(vcf_file.content_type) else "utf-8", errors="ignore")
                
                for res in final_response["results"]:
                    drug_name = res["drug"]
                    ml_pred = ml_extractor.predict_risk(vcf_content, drug_name)
                    
                    # Load model metadata for transparency
                    model_metadata = {}
                    try:
                        import json
                        meta_path = os.path.join(model_dir, "ensemble_metadata.json")
                        with open(meta_path, "r") as f:
                            model_metadata = json.load(f)
                    except:
                        pass

                    # Add ML metrics to the JSON record
                    res["ml_risk_analysis"] = {
                        "prediction_label": ml_pred["risk_level"],
                        "confidence_probability": round(ml_pred["probability"], 4),
                        "ml_model_used": model_metadata.get("model_type", "Ensemble_v1.0_Stochastic"),
                        "model_auc_score": model_metadata.get("ensemble_auc", 0.95),
                        "ml_features": ml_pred["features"],
                        "medication_alternatives": ml_pred["recommendation"]
                    }
            except Exception as ml_err:
                logger.error(f"ML Processing failed: {ml_err}")

        return final_response
    except Exception as e:
        logger.exception("Unexpected error in /api/analyze")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Internal Server Error", "message": str(e)}
        )

@app.post("/validate-vcf", status_code=status.HTTP_200_OK)
async def validate_vcf(file: UploadFile = File(...)):
    """
    Validates an uploaded VCF file for pharmacogenomic analysis using streaming.
    """
async def process_vcf_file(file: UploadFile):
    """
    Core logic to validate and profile a VCF file.
    Returns a dictionary with validation results, profile, or error details.
    """
    try:
        # Step 1: File Extension Check
        if not file.filename.lower().endswith('.vcf'):
             return {"valid": False, "error_type": "InvalidExtension", "message": "Uploaded file is not a valid VCF file", "status_code": status.HTTP_400_BAD_REQUEST}
        
        # Validation State
        vcf_version = None
        has_chrom_header = False
        total_variants = 0
        pharmacogene_variants = 0
        genes_detected: Set[str] = set()
        warnings: List[str] = []
        
        seen_gene_tag = False
        seen_rs_tag = False
        seen_star_tag = False
        space_normalization_active = False
        valid_lines_for_profiling = [] # Store lines for profiling engine
        
        def process_line(line_str: str, line_num: int):
            nonlocal vcf_version, has_chrom_header, total_variants, pharmacogene_variants
            nonlocal seen_gene_tag, seen_rs_tag, seen_star_tag, space_normalization_active
            
            line_str = line_str.strip()
            if not line_str:
                return 

            # Header Validation
            if line_str.startswith("##"):
                if line_str.startswith("##fileformat="):
                    vcf_version = line_str.split("=")[1].strip()
                    if vcf_version != "VCFv4.2":
                         raise ValueError("Invalid VCF header — missing required fields (Version mismatch)")
                return

            if line_str.startswith("#"):
                if line_str.startswith("#CHROM"):
                    if line_str.startswith("#CHROM\t"):
                         cols = line_str.split("\t")
                    else:
                         parts = line_str.split()
                         if len(parts) >= 8 and parts[0] == "#CHROM":
                              space_normalization_active = True
                              if "File normalized: space-separated VCF converted to tab-separated format" not in warnings:
                                   warnings.append("File normalized: space-separated VCF converted to tab-separated format")
                              cols = parts
                         else:
                              raise ValueError("Invalid VCF header — missing required fields or invalid separator")

                    if len(cols) < 8:
                         raise ValueError("Invalid VCF header — missing required fields")
                    has_chrom_header = True
                return
            
            if not has_chrom_header:
                raise ValueError("Invalid VCF header — missing required fields (Missing #CHROM header)")

            # Split columns
            if space_normalization_active:
                cols = line_str.split()
            else:
                cols = line_str.split("\t")
            
            # Auto-detect normalization fallback
            if len(cols) < 8 and not space_normalization_active:
                 parts = line_str.split()
                 if len(parts) >= 8:
                      space_normalization_active = True
                      if "File normalized: space-separated VCF converted to tab-separated format" not in warnings:
                           warnings.append("File normalized: space-separated VCF converted to tab-separated format")
                      cols = parts
            
            if len(cols) < 8:
                 raise ValueError(f"Malformed variant records detected (Line {line_num}: Insufficient columns)")
            
            try:
                if cols[1] == '.': 
                     raise ValueError(f"Corrupted variant entries detected (Line {line_num}: Missing POS)")
                pos = int(cols[1])
            except ValueError:
                 raise ValueError(f"Malformed variant records detected (Line {line_num}: POS not integer)")
            
            ref = cols[3].upper()
            alt = cols[4].upper()
            var_id = cols[2]
            
            if alt == '.' or var_id == '.':
                 raise ValueError(f"Corrupted variant entries detected (Line {line_num}: Missing ID or ALT)")
            
            valid_bases = set("ACGT")
            if not all(c in valid_bases for c in ref):
                 raise ValueError(f"Malformed variant records detected (Line {line_num}: Invalid REF bases)")
            if not all(c in valid_bases for c in alt):
                 raise ValueError(f"Malformed variant records detected (Line {line_num}: Invalid ALT bases)")

            info_field = cols[7]
            info_parts = info_field.split(";")
            info_dict = {}
            for part in info_parts:
                if "=" in part:
                    k, v = part.split("=", 1)
                    info_dict[k] = v
                else:
                    info_dict[part] = True
            
            if "GENE" in info_dict: seen_gene_tag = True
            if "RS" in info_dict: seen_rs_tag = True
            if "STAR" in info_dict: seen_star_tag = True
            
            gene = info_dict.get("GENE")
            if gene:
                genes_detected.add(gene)
                if gene in TARGET_GENES:
                    pharmacogene_variants += 1
            
            total_variants += 1

            if not line_str.startswith("##"):
                 valid_lines_for_profiling.append(line_str)

        
        # Read loop - Single Pass
        line_buffer = ""
        line_number = 0
        total_size = 0
        chunk_size = 64 * 1024
        
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                 return {"valid": False, "error_type": "FileTooLarge", "message": "File size must be < 5MB", "status_code": status.HTTP_413_REQUEST_ENTITY_TOO_LARGE}
            
            text = chunk.decode("utf-8", errors="ignore")
            line_buffer += text
            
            while '\n' in line_buffer:
                line, line_buffer = line_buffer.split('\n', 1)
                line_number += 1
                try:
                    process_line(line, line_number)
                except ValueError as e:
                    err_msg = str(e)
                    user_msg = err_msg.split("(")[0].strip()
                    return {"valid": False, "error_type": "ValidationError", "message": user_msg, "status_code": status.HTTP_400_BAD_REQUEST}
        
        
        if line_buffer:
            line_number += 1
            try:
                process_line(line_buffer, line_number)
            except ValueError as e:
                 err_msg = str(e)
                 user_msg = err_msg.split("(")[0].strip()
                 return {"valid": False, "error_type": "ValidationError", "message": user_msg, "status_code": status.HTTP_400_BAD_REQUEST}

        if total_size < MIN_FILE_SIZE:
             return {"valid": False, "error_type": "FileTooSmall", "message": "File size must be > 1KB", "status_code": status.HTTP_400_BAD_REQUEST}
        
        if not vcf_version:
             return {"valid": False, "error_type": "InvalidHeader", "message": "Invalid VCF header — missing required fields", "status_code": status.HTTP_400_BAD_REQUEST}
            
        if not has_chrom_header:
             return {"valid": False, "error_type": "InvalidHeader", "message": "Invalid VCF header — missing required fields", "status_code": status.HTTP_400_BAD_REQUEST}

        if total_variants < 1:
             return {"valid": False, "error_type": "InsufficientData", "message": "VCF file contains insufficient genomic data (must have at least 1 variant)", "status_code": status.HTTP_400_BAD_REQUEST}

        if pharmacogene_variants == 0:
             return {"valid": False, "error_type": "NoPharmacogenes", "message": "No pharmacogenomic variants detected in file", "status_code": status.HTTP_400_BAD_REQUEST}
            
        if not (seen_gene_tag and seen_rs_tag and seen_star_tag):
             return {"valid": False, "error_type": "MissingAnnotations", "message": "VCF lacks pharmacogenomic annotations (GENE/STAR/RS)", "status_code": status.HTTP_400_BAD_REQUEST}

        # Genetic Profiling Engine Integration
        profiling_result = {}
        try:
            extracted_data = extract_variants(valid_lines_for_profiling)
            raw_diplotypes = build_diplotype(extracted_data)
            
            for gene in TARGET_GENES:
                diplotype = raw_diplotypes.get(gene, "*1/*1")
                phenotype = get_phenotype(gene, diplotype)
                detected = extracted_data.get(gene, {})
                
                profiling_result[gene] = {
                    "diplotype": diplotype,
                    "phenotype": phenotype,
                    "detected_variants": detected.get("variants", [])
                }
                
        except Exception as e:
            logger.error(f"Profiling Engine Error: {e}")
            warnings.append(f"Genetic profiling failed: {str(e)}")

        return {
            "valid": True,
            "vcf_version": vcf_version,
            "total_variants": total_variants,
            "pharmacogene_variants": pharmacogene_variants,
            "genes_detected": list(genes_detected),
            "warnings": warnings,
            "genetic_profile": profiling_result,
            "status_code": status.HTTP_200_OK
        }

    except Exception as e:
        logger.error(f"Error processing VCF: {e}")
        return {"valid": False, "error_type": "ProcessingError", "message": "An unexpected error occurred processing the file", "status_code": status.HTTP_400_BAD_REQUEST}


@app.post("/validate-vcf", status_code=status.HTTP_200_OK)
async def validate_vcf(file: UploadFile = File(...)):
    """
    Validates an uploaded VCF file for pharmacogenomic analysis using streaming.
    """
    result = await process_vcf_file(file)
    
    if not result.get("valid"):
        return JSONResponse(
            status_code=result.get("status_code", status.HTTP_400_BAD_REQUEST),
            content={
                "valid": False, 
                "error_type": result.get("error_type"), 
                "message": result.get("message")
            }
        )
    
    # Remove internal status_code before returning
    response_data = result.copy()
    response_data.pop("status_code", None)
    return response_data


# ── Real-time Chat WebSocket ────────────────────────────────────────────
@app.websocket("/ws/chat/{user_id}")
async def chat_websocket(websocket: WebSocket, user_id: str):
    """
    Each authenticated user connects here with their Supabase user ID.
    The server keeps them in a room so we can push messages to them in real-time.
    """
    await chat_manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive — client messages are sent via REST
            await websocket.receive_text()
    except WebSocketDisconnect:
        chat_manager.disconnect(user_id)


# ── Chat REST Endpoints ─────────────────────────────────────────────────
class ChatSendRequest(BaseModel):
    receiver_id: str
    message: str

@app.post("/api/chat/send")
async def send_chat_message(req: ChatSendRequest, request: Request):
    """
    Persists a message in Supabase and emits it to the receiver via WebSocket.
    The sender's user ID must be passed in the X-User-Id header.
    """
    sender_id = request.headers.get("x-user-id")
    if not sender_id:
        return JSONResponse(status_code=400, content={"error": "Missing x-user-id header"})

    supabase_url, headers = get_supabase_headers()

    new_message = {
        "id": str(uuid.uuid4()),
        "sender_id": sender_id,
        "receiver_id": req.receiver_id,
        "message": req.message,
        "read": False,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }

    # 1. Save to Supabase (if configured)
    if supabase_url:
        try:
            import requests as http_requests
            http_requests.post(
                f"{supabase_url}/rest/v1/chat_messages",
                json=new_message,
                headers=headers
            )
        except Exception as e:
            logger.warning(f"[Chat] Supabase save failed: {e}")

    # 2. Push to receiver via WebSocket if they are connected
    await chat_manager.send_to_user(req.receiver_id, {
        "type": "new_message",
        "message": new_message
    })

    return new_message


@app.get("/api/chat/{receiver_id}")
async def get_chat_history(receiver_id: str, request: Request):
    """
    Returns all messages between the requesting user and the specified receiver.
    """
    sender_id = request.headers.get("x-user-id")
    if not sender_id:
        return JSONResponse(status_code=400, content={"error": "Missing x-user-id header"})

    supabase_url, headers = get_supabase_headers()

    if not supabase_url:
        return []  # Chat history not available without Supabase

    try:
        import requests as http_requests
        hdrs = {**headers, "Accept": "application/json"}

        # Fetch A→B
        r1 = http_requests.get(
            f"{supabase_url}/rest/v1/chat_messages"
            f"?sender_id=eq.{sender_id}&receiver_id=eq.{receiver_id}&order=created_at.asc",
            headers=hdrs
        )
        # Fetch B→A
        r2 = http_requests.get(
            f"{supabase_url}/rest/v1/chat_messages"
            f"?sender_id=eq.{receiver_id}&receiver_id=eq.{sender_id}&order=created_at.asc",
            headers=hdrs
        )
        msgs1 = r1.json() if r1.ok else []
        msgs2 = r2.json() if r2.ok else []

        # Merge and sort by created_at
        all_msgs = msgs1 + msgs2
        all_msgs.sort(key=lambda m: m.get("created_at", ""))
        return all_msgs
    except Exception as e:
        logger.error(f"[Chat] History fetch failed: {e}")
        return []


@app.get("/api/my-doctor")
async def get_my_doctor(request: Request):
    """
    Returns the linked doctor's id and name for the calling patient.
    Uses the service key so it bypasses RLS on both doctor_patients and profiles.
    The patient's user ID must be passed in the X-User-Id header.
    """
    patient_id = request.headers.get("x-user-id")
    if not patient_id:
        return JSONResponse(status_code=400, content={"error": "Missing x-user-id header"})

    supabase_url, headers = get_supabase_headers()
    if not supabase_url:
        return JSONResponse(status_code=503, content={"error": "Supabase not configured"})

    import requests as http_requests

    try:
        # Step 1: find the doctor_id for this patient
        dp_res = http_requests.get(
            f"{supabase_url}/rest/v1/doctor_patients"
            f"?patient_id=eq.{patient_id}&select=doctor_id&limit=1",
            headers={**headers, "Accept": "application/json"}
        )
        dp_data = dp_res.json() if dp_res.ok else []
        if not dp_data:
            return JSONResponse(status_code=404, content={"error": "No linked doctor found"})

        doctor_id = dp_data[0]["doctor_id"]

        # Step 2: fetch doctor's name from profiles (service key bypasses RLS)
        prof_res = http_requests.get(
            f"{supabase_url}/rest/v1/profiles"
            f"?id=eq.{doctor_id}&select=id,name&limit=1",
            headers={**headers, "Accept": "application/json"}
        )
        prof_data = prof_res.json() if prof_res.ok else []
        if not prof_data:
            return JSONResponse(status_code=404, content={"error": "Doctor profile not found"})

        return {"id": prof_data[0]["id"], "name": prof_data[0]["name"]}

    except Exception as e:
        logger.error(f"[my-doctor] Failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── Report Generation Endpoint ──────────────────────────────────────────

class ReportRequest(BaseModel):
    results: List[dict]

@app.post("/api/generate-report")
async def generate_report(req: ReportRequest):
    """
    Generates a PDF report based on the analysis results.
    """
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom Styles
        title_style = styles['Title']
        heading_style = styles['Heading2']
        normal_style = styles['Normal']
        
        # Title
        story.append(Paragraph("PharmaGuard Pharmacogenomic Report", title_style))
        story.append(Spacer(1, 12))
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        story.append(Paragraph(f"Generated on: {timestamp}", normal_style))
        story.append(Spacer(1, 24))

        # Iterate through results
        for item in req.results:
            drug = item.get("drug", "Unknown Drug")
            risk = item.get("risk_assessment", {})
            profile = item.get("pharmacogenomic_profile", {})
            explanation = item.get("llm_generated_explanation", {}).get("summary", "")
            
            # Drug Header
            story.append(Paragraph(f"Drug: {drug}", heading_style))
            
            # Risk Table Data
            data = [
                ["Risk Level", risk.get("risk_label", "Unknown")],
                ["Severity", risk.get("severity", "None").title()],
                ["Genotype", f"{profile.get('primary_gene')} {profile.get('diplotype')}"],
                ["Phenotype", profile.get("phenotype")]
            ]
            
            # Table Style based on risk
            risk_color = colors.green
            label = risk.get("risk_label", "").upper()
            if label in ["TOXIC", "INEFFECTIVE", "HIGH"]:
                risk_color = colors.red
            elif label == "ADJUST DOSAGE" or label == "MODERATE":
                risk_color = colors.orange
                
            t = Table(data, colWidths=[150, 300])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 3), colors.whitesmoke),
                ('TEXTCOLOR', (0, 0), (0, 3), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('TEXTCOLOR', (1, 0), (1, 0), risk_color), # Color the Risk Label
            ]))
            
            story.append(t)
            story.append(Spacer(1, 12))
            
            # Explanation
            story.append(Paragraph("<b>Clinical Explanation:</b>", normal_style))
            story.append(Paragraph(explanation, normal_style))
            story.append(Spacer(1, 24))
            
            # Divider
            story.append(Paragraph("_" * 60, normal_style))
            story.append(Spacer(1, 24))

        doc.build(story)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=PharmaGuard_Report.pdf"}
        )
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
