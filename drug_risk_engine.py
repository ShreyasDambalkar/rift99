# risk_predictor.py

from typing import List, Dict
from pydantic import BaseModel


# ------------------------------
# Phenotype Model
# ------------------------------

class PhenotypeProfile(BaseModel):
    CYP2D6: str = "Unknown"
    CYP2C19: str = "Unknown"
    CYP2C9: str = "Unknown"
    SLCO1B1: str = "Unknown"
    TPMT: str = "Unknown"
    DPYD: str = "Unknown"


# ------------------------------
# Phenotype Normalization
# ------------------------------

def normalize_pheno(p: str) -> str:

    mapping = {
        "POOR METABOLIZER": "PM",
        "INTERMEDIATE METABOLIZER": "IM",
        "NORMAL METABOLIZER": "NM",
        "RAPID METABOLIZER": "RM",
        "ULTRA RAPID METABOLIZER": "UM"
    }

    if not p:
        return "Unknown"

    return mapping.get(p.upper(), p.upper())


# ------------------------------
# Drug → Gene Mapping
# ------------------------------

DRUG_GENE_MAPPING = {
    "CODEINE": "CYP2D6",
    "WARFARIN": "CYP2C9",
    "CLOPIDOGREL": "CYP2C19",
    "SIMVASTATIN": "SLCO1B1",
    "AZATHIOPRINE": "TPMT",
    "FLUOROURACIL": "DPYD"
}


# ------------------------------
# CPIC Risk Rules
# ------------------------------

RISK_RULES = {

    # PRODRUG
    "CODEINE": {
        "PM": ["Ineffective","moderate"],
        "IM": ["Adjust Dosage","moderate"],
        "NM": ["Safe","none"],
        "UM": ["Toxic","high"]
    },

    # FIXED ✅
    "CLOPIDOGREL": {
        "PM": ["Ineffective","high"],
        "IM": ["Adjust Dosage","moderate"],
        "NM": ["Safe","none"],
        "RM": ["Safe","none"],
        "UM": ["Safe","none"]
    },

    "WARFARIN": {
        "PM": ["Toxic","high"],
        "IM": ["Adjust Dosage","moderate"],
        "NM": ["Safe","none"]
    },

    "SIMVASTATIN": {
        "PM": ["Toxic","high"],
        "IM": ["Adjust Dosage","moderate"],
        "NM": ["Safe","none"]
    },

    "AZATHIOPRINE": {
        "PM": ["Toxic","critical"],
        "IM": ["Adjust Dosage","high"],
        "NM": ["Safe","none"]
    },

    "FLUOROURACIL": {
        "PM": ["Toxic","critical"],
        "IM": ["Adjust Dosage","high"],
        "NM": ["Safe","none"]
    }
}


CONFIDENCE = {
    "known": 0.98,
    "partial": 0.7,
    "unknown": 0.3
}


# ------------------------------
# Core Prediction Engine
# ------------------------------

def predict_drug_risks(
    drug_names: str,
    phenotype_profile: Dict
) -> List[Dict]:

    results = []

    profile = PhenotypeProfile(**phenotype_profile).dict()

    drugs = [d.strip().upper()
             for d in drug_names.split(",") if d.strip()]

    for drug in drugs:

        gene = DRUG_GENE_MAPPING.get(drug)

        phenotype = normalize_pheno(
            profile.get(gene, "Unknown")
        ) if gene else "Unknown"

        risk = "Unknown"
        severity = "none"
        confidence = CONFIDENCE["unknown"]

        if gene:
            rule = RISK_RULES.get(drug, {}).get(phenotype)

            if rule:
                risk, severity = rule
                confidence = CONFIDENCE["known"]
            elif phenotype != "Unknown":
                risk = "Adjust Dosage"
                severity = "low"
                confidence = CONFIDENCE["partial"]

        results.append({
            "drug": drug,
            "primary_gene": gene or "Unknown",
            "phenotype": phenotype,
            "risk_label": risk,
            "severity": severity,
            "confidence_score": confidence
        })

    return results