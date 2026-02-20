import datetime
import uuid
from typing import List, Dict, Any

def format_analysis_result(
    vcf_result: Dict[str, Any],
    risk_assessments: List[Dict[str, Any]],
    explanations: Dict[str, str]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Formats the analysis results into the strict hackathon JSON schema.
    
    Args:
        vcf_result: Output from process_vcf_file (profile, validation stats)
        risk_assessments: Output from predict_drug_risks
        explanations: Dictionary mapping drug name to explanation text
        
    Returns:
        JSON-compliant dictionary with "results" array.
    """
    
    formatted_results = []
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"
    patient_id = f"PATIENT_{uuid.uuid4().hex[:8].upper()}"
    
    genetic_profile = vcf_result.get("genetic_profile", {})
    
    for assessment in risk_assessments:
        drug = assessment["drug"]
        gene = assessment["primary_gene"]
        phenotype = assessment["phenotype"]
        risk_label = assessment["risk_label"]
        severity = assessment["severity"]
        confidence = assessment["confidence_score"]
        
        # Get specific gene profile details
        gene_data = genetic_profile.get(gene, {})
        diplotype = gene_data.get("diplotype", "Unknown")
        # Detected variants structure from extractor needs to be mapped to rsids if possible
        # gene_data["detected_variants"] is list of dicts like {"allele": "*4"}
        # deeper introspection of vcf_result or extractor output might be needed for RSIDs
        # For now, we use the alleles as the primary variant info.
        
        detected_variants = []
        for variant in gene_data.get("detected_variants", []):
             detected_variants.append({
                 "allele": variant.get("allele", "N/A"),
                 "rsid": variant.get("rsid", "N/A")
             })
             
        # Explanation
        explanation_text = explanations.get(drug, "Genetic factors influence drug metabolism.")
        
        # Clinical Recommendation (Rule-based stub)
        recommendation = {
            "action": "Proceed with Standard Protocol",
            "guideline": "CPIC Level B"
        }
        if severity in ["high", "critical"]:
             recommendation = {
                 "action": "Consider Alternative Therapy",
                 "guideline": "CPIC Level A"
             }
        elif risk_label == "Adjust Dosage":
             recommendation = {
                 "action": "Adjust Dosage",
                 "guideline": "CPIC Level A"
             }

        entry = {
            "patient_id": patient_id,
            "drug": drug,
            "timestamp": timestamp,
            "risk_assessment": {
                "risk_label": risk_label,
                "severity": severity,
                "confidence_score": confidence
            },
            "pharmacogenomic_profile": {
                "primary_gene": gene,
                "phenotype": phenotype,
                "diplotype": diplotype,
                "detected_variants": detected_variants
            },
            "clinical_recommendation": recommendation,
            "llm_generated_explanation": {
                "summary": explanation_text
            },
            "quality_metrics": {
                "vcf_parsing_success": vcf_result.get("valid", False),
                "gene_found": gene in genetic_profile,
                "phenotype_determined": phenotype != "Unknown"
            }
        }
        formatted_results.append(entry)
        
    return {"results": formatted_results}