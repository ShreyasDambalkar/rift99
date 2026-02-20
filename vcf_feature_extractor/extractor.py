import re
import pandas as pd
import numpy as np
from typing import List, Dict, Any

import joblib
import numpy as np

class VCFFeatureExtractor:
    """
    Core feature extraction engine for Drug Risk Machine Learning.
    Parses VCF files to extract genomic features and interaction metrics.
    """

    def __init__(self, drug_gene_mapping: Dict[str, List[str]] = None, model_dir: str = "models"):
        # Default mapping of common PGx drugs to their relevant genes
        self.drug_gene_mapping = drug_gene_mapping or {
            "Warfarin": ["CYP2C9", "VKORC1"],
            "Clopidogrel": ["CYP2C19"],
            "Simvastatin": ["SLCO1B1"],
            "Codeine": ["CYP2D6"],
            "Abacavir": ["HLA-B"]
        }
        self.model_dir = model_dir
        self.model = None
        self.scaler = None

    def load_model(self):
        """Loads the pre-trained ensemble model and scaler."""
        try:
            import os
            model_path = os.path.join(self.model_dir, "ensemble_model.pkl")
            scaler_path = os.path.join(self.model_dir, "ensemble_scaler.pkl")
            
            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            return True
        except Exception as e:
            print(f"Error loading models from {self.model_dir}: {e}")
            return False

    def get_alternatives(self, drug_name: str) -> Dict[str, Any]:
        """Provides safer alternative medications and evidence-based rationale."""
        alternatives_map = {
            "WARFARIN": {
                "drug": "Apixaban",
                "reason": "Lower bleeding risk and more predictable pharmacokinetics.",
                "evidence": "Apixaban does not require INR monitoring and has fewer drug-gene interactions compared to warfarin.",
                "dosage": "5mg twice daily (standard), or 2.5mg twice daily if clinical factors apply."
            },
            "CLOPIDOGREL": {
                "drug": "Ticagrelor",
                "reason": "Bypasses the CYP2C19 activation pathway.",
                "evidence": "Ticagrelor is not a prodrug and is not affected by the CYP2C19*2 loss-of-function variants commonly found in high-risk patients.",
                "dosage": "90mg twice daily."
            },
            "SIMVASTATIN": {
                "drug": "Atorvastatin",
                "reason": "Lower risk of SLCO1B1-related myopathy.",
                "evidence": "Atorvastatin has a different metabolic profile and clinical trials show higher safety margins in patients with SLCO1B1 variants.",
                "dosage": "10-20mg daily, titrate based on lipid response."
            },
            "CODEINE": {
                "drug": "Tramadol",
                "reason": "Reduced dependence on CYP2D6 metabolism for analgesia.",
                "evidence": "While still metabolized, Tramadol shows more consistent efficacy in CYP2D6 poor/intermediate metabolizers compared to codeine.",
                "dosage": "50mg every 4-6 hours as needed."
            }
        }
        
        return alternatives_map.get(drug_name.upper(), {
            "drug": "Alternative medication",
            "reason": "General genetic risk detected.",
            "evidence": "Consult with a clinical pharmacist for personalized medication review.",
            "dosage": "Per clinician discretion."
        })

    def predict_risk(self, vcf_content: str, drug_name: str) -> Dict[str, Any]:
        """
        Extracts features and performs a prediction using the loaded model.
        """
        features = self.extract_features(vcf_content, drug_name)
        
        if self.model is None or self.scaler is None:
            if not self.load_model():
                return {"features": features, "error": "Model not loaded"}

        # Prepare feature vector for prediction (matching training order)
        feature_vector = np.array([[
            features["VARIANT_COUNT"],
            features["HIGH_RISK_VARIANTS"],
            0.5, # RISK_SCORE (Seed value)
            features["DRUG_RISK_RATIO"],
            features["VARIANT_DENSITY"],
            features["UNIQUE_GENES"],
            features["HIGH_IMPACT_VARIANTS"],
            features["PATHOGENIC_VARIANTS"],
            2, # DRUG_INTERACTIONS (Dummy)
            1  # HIGH_SIGNIFICANCE_INTERACTIONS (Dummy)
        ]])

        scaled_vector = self.scaler.transform(feature_vector)
        prediction = self.model.predict(scaled_vector)[0]
        probability = float(self.model.predict_proba(scaled_vector)[0][1])
        
        risk_level = "HIGH" if probability > 0.7 else ("MODERATE" if probability > 0.4 else "LOW")
        
        # Add alternative feature
        alternatives = None
        if risk_level in ["HIGH", "MODERATE"]:
            alternatives = self.get_alternatives(drug_name)

        return {
            "prediction": int(prediction),
            "probability": probability,
            "risk_level": risk_level,
            "recommendation": alternatives,
            "features": features
        }

    def parse_vcf(self, vcf_content: str) -> List[Dict[str, Any]]:
        """Parses VCF text into a list of variant dictionaries."""
        variants = []
        lines = vcf_content.strip().split('\n')
        
        for line in lines:
            if line.startswith('#') or not line.strip():
                continue
                
            parts = line.split('\t')
            if len(parts) < 8:
                continue
            
            info = parts[7]
            variant = {
                "chrom": parts[0],
                "pos": parts[1],
                "ref": parts[3],
                "alt": parts[4],
                "gene": self._extract_field(info, r'Gene=([^;]+)|GENE=([^;]+)'),
                "impact": self._extract_field(info, r'IMPACT=([^;]+)'),
                "clnsig": self._extract_field(info, r'CLNSIG=([^;]+)|CLIN_SIG=([^;]+)'),
                "interactions": self._extract_field(info, r'Drug=([^;]+)'),
                "raw_info": info
            }
            variants.append(variant)
            
        return variants

    def extract_features(self, vcf_content: str, drug_name: str) -> Dict[str, Any]:
        """
        Processes VCF data to produce the feature vector used by the 
        Ensemble ML model.
        """
        variants = self.parse_vcf(vcf_content)
        
        if not variants:
            return self._get_empty_features()

        # 1. Filter variants relevant to the specific drug
        relevant_genes = self.drug_gene_mapping.get(drug_name, [])
        relevant_variants = [
            v for v in variants 
            if (v["gene"] in relevant_genes) or 
               (v["interactions"] and drug_name.lower() in v["interactions"].lower())
        ]

        # Use full variants if no specific drug-relevant ones found (fail-safe)
        active_vars = relevant_variants if relevant_variants else variants

        # 2. Compute Core Counts
        total_variants = len(active_vars)
        high_impact = sum(1 for v in active_vars if v["impact"] == "HIGH")
        pathogenic = sum(1 for v in active_vars if v["clnsig"] and "pathogenic" in v["clnsig"].lower())
        unique_genes = len(set(v["gene"] for v in active_vars if v["gene"]))

        # 3. Calculate Ensemble Model Features
        features = {
            "VARIANT_COUNT": total_variants,
            "HIGH_RISK_VARIANTS": high_impact + pathogenic,
            "VARIANT_DENSITY": total_variants / 1000.0,
            "UNIQUE_GENES": unique_genes,
            "HIGH_IMPACT_VARIANTS": high_impact,
            "PATHOGENIC_VARIANTS": pathogenic,
            "DRUG_RISK_RATIO": (high_impact + pathogenic) / max(1, total_variants),
            "INTERACTION_DENSITY": 1.0 / max(1, unique_genes) # Normalized proxy
        }

        # 4. Add derived risk metrics
        features["RISK_SCORE_SQUARED"] = (features["DRUG_RISK_RATIO"] ** 2)
        features["FEATURE_COUNT"] = len(features)

        return features

    def _extract_field(self, info: str, pattern: str) -> str:
        """Helper to extract values from VCF INFO column using regex."""
        match = re.search(pattern, info, re.IGNORECASE)
        if match:
            # Return the first non-None group
            return next((g for g in match.groups() if g is not None), None)
        return None

    def _get_empty_features(self) -> Dict[str, Any]:
        """Returns a zeroed-out feature set for empty inputs."""
        cols = ["VARIANT_COUNT", "HIGH_RISK_VARIANTS", "VARIANT_DENSITY", 
                "UNIQUE_GENES", "HIGH_IMPACT_VARIANTS", "PATHOGENIC_VARIANTS", 
                "DRUG_RISK_RATIO", "INTERACTION_DENSITY", "RISK_SCORE_SQUARED"]
        return {c: 0 for c in cols}

if __name__ == "__main__":
    # Test Data
    sample_vcf = "1\t12345\t.\tA\tG\t.\t.\tGene=CYP2C19;IMPACT=HIGH;CLNSIG=Pathogenic"
    extractor = VCFFeatureExtractor()
    print("Extracted Features for Clopidogrel:")
    print(extractor.extract_features(sample_vcf, "Clopidogrel"))
