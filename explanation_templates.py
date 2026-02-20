
from typing import Optional, Dict
import requests

# Central repository of explanations
# Key format: "{GENE}_{PHENOTYPE}" or "{DRUG}_{PHENOTYPE}"
# We prioritize Drug-Phenotype keys, fallback to Gene-Phenotype

EXPLANATION_TEMPLATES = {
    # ── CYP2D6 Gene-level ──────────────────────────────────
    "CYP2D6_PM": "Reduced CYP2D6 activity prevents conversion of prodrugs to active forms and increases exposure to active drugs metabolized by this enzyme.",
    "CYP2D6_IM": "Intermediate CYP2D6 activity may result in reduced efficacy of prodrugs or slightly increased exposure to active drugs.",
    "CYP2D6_UM": "Ultrarapid metabolism increases conversion of prodrugs to active forms (toxicity risk) and rapidly clears active drugs (inefficacy).",
    "CYP2D6_NM": "Normal CYP2D6 metabolism. Standard drug dosing is expected to be effective and safe.",

    # ── CYP2C19 Gene-level ─────────────────────────────────
    "CYP2C19_PM": "Poor metabolizers have significantly reduced enzyme activity, affecting drugs like clopidogrel (prodrug) and SSRIs.",
    "CYP2C19_IM": "Intermediate CYP2C19 activity may reduce prodrug activation or slow clearance of active drugs.",
    "CYP2C19_RM": "Rapid metabolizers have increased enzyme activity, potentially reducing efficacy of drugs like proton pump inhibitors.",
    "CYP2C19_UM": "Ultrarapid CYP2C19 metabolism increases prodrug activation and accelerates clearance of active drugs.",
    "CYP2C19_NM": "Normal CYP2C19 metabolism. Standard dosing is appropriate.",

    # ── CYP2C9 Gene-level ──────────────────────────────────
    "CYP2C9_PM": "Significantly reduced metabolism increases plasma concentrations of drugs like warfarin and phenytoin, raising toxicity risk.",
    "CYP2C9_IM": "Reduced metabolism may require lower starting doses for sensitive drugs to avoid adverse effects.",
    "CYP2C9_NM": "Normal CYP2C9 metabolism. Standard dosing is appropriate.",

    # ── SLCO1B1 Gene-level ─────────────────────────────────
    "SLCO1B1_PM": "Reduced transporter function increases systemic exposure to statins (e.g., simvastatin), significantly increasing myopathy risk.",
    "SLCO1B1_IM": "Intermediate transporter function may require monitoring or dose adjustment for statins.",
    "SLCO1B1_NM": "Normal SLCO1B1 transporter function. Standard statin dosing is appropriate.",

    # ── TPMT Gene-level ────────────────────────────────────
    "TPMT_PM": "Absent TPMT activity causes dangerous accumulation of thiopurine metabolites, leading to potentially fatal myelosuppression.",
    "TPMT_IM": "Reduced TPMT activity increases thiopurine toxicity risk. Dose reduction is strongly recommended.",
    "TPMT_NM": "Normal TPMT activity. Standard thiopurine dosing is appropriate.",

    # ── DPYD Gene-level ────────────────────────────────────
    "DPYD_PM": "DPYD deficiency prevents fluoropyrimidine breakdown, causing life-threatening toxicity including severe mucositis and myelosuppression.",
    "DPYD_IM": "Reduced DPYD activity increases fluoropyrimidine toxicity risk. Significant dose reduction is required.",
    "DPYD_NM": "Normal DPYD activity. Standard fluoropyrimidine dosing is appropriate.",

    # ── Drug-specific overrides ────────────────────────────
    # CYP2D6 prodrugs
    "CODEINE_PM": "Codeine is a prodrug requiring CYP2D6 for activation. Poor metabolizers cannot convert it to morphine, resulting in lack of analgesia.",
    "CODEINE_UM": "Ultrarapid metabolizers convert codeine to morphine too quickly, carrying a high risk of life-threatening respiratory depression.",
    "TRAMADOL_PM": "Tramadol requires CYP2D6 activation to its active metabolite O-desmethyltramadol. Poor metabolizers experience reduced analgesic effect.",
    "TRAMADOL_UM": "Ultrarapid CYP2D6 metabolism increases tramadol's active metabolite levels, raising the risk of respiratory depression and seizures.",
    "HYDROCODONE_PM": "Hydrocodone requires CYP2D6 for conversion to hydromorphone. Poor metabolizers may have reduced pain relief.",
    "TAMOXIFEN_PM": "Tamoxifen requires CYP2D6 activation to endoxifen. Poor metabolizers have reduced active metabolite levels, potentially decreasing breast cancer treatment efficacy.",
    "TAMOXIFEN_IM": "Intermediate CYP2D6 activity reduces endoxifen levels from tamoxifen, which may decrease therapeutic benefit.",

    # CYP2D6 active drugs
    "ATOMOXETINE_PM": "Poor CYP2D6 metabolizers have significantly higher atomoxetine plasma levels, increasing risk of cardiovascular side effects and nausea.",
    "FLUOXETINE_PM": "Reduced CYP2D6 metabolism leads to higher fluoxetine exposure, increasing the risk of serotonergic side effects.",
    "PAROXETINE_PM": "Poor CYP2D6 metabolizers experience elevated paroxetine levels, increasing risk of side effects including QT prolongation.",
    "VENLAFAXINE_PM": "Reduced CYP2D6 metabolism shifts venlafaxine/desvenlafaxine ratio, potentially altering efficacy and side effect profile.",
    "AMITRIPTYLINE_PM": "CYP2D6 poor metabolizers accumulate amitriptyline and its active metabolite, increasing risk of cardiac toxicity and excessive sedation.",
    "NORTRIPTYLINE_PM": "Elevated nortriptyline levels due to poor CYP2D6 metabolism increase cardiac arrhythmia risk and anticholinergic side effects.",
    "METOPROLOL_PM": "Poor CYP2D6 metabolizers have 3-5x higher metoprolol exposure, increasing risk of severe bradycardia and hypotension.",
    "FLECAINIDE_PM": "Reduced CYP2D6 metabolism increases flecainide levels, raising the risk of pro-arrhythmic effects.",
    "RISPERIDONE_PM": "Poor CYP2D6 metabolizers accumulate risperidone, increasing risk of extrapyramidal symptoms and QT prolongation.",
    "ARIPIPRAZOLE_PM": "Poor CYP2D6 metabolizers may require dose reduction for aripiprazole to avoid excessive dopamine receptor blockade.",
    "ONDANSETRON_PM": "Reduced CYP2D6 metabolism may increase ondansetron exposure, though clinical significance is generally low.",

    # CYP2C19 drugs
    "CLOPIDOGREL_PM": "Clopidogrel requires CYP2C19 to become active. Poor metabolizers exhibit reduced platelet inhibition and higher risk of cardiovascular events.",
    "CLOPIDOGREL_IM": "Intermediate metabolizers produce less active metabolite, potentially reducing antiplatelet efficacy.",
    "OMEPRAZOLE_PM": "Poor CYP2C19 metabolizers have prolonged omeprazole exposure, leading to greater acid suppression but increased risk of long-term side effects.",
    "PANTOPRAZOLE_PM": "Poor CYP2C19 metabolizers show increased pantoprazole levels, though clinical impact is generally less than with omeprazole.",
    "LANSOPRAZOLE_PM": "Poor CYP2C19 metabolizers have extended lansoprazole exposure, resulting in enhanced acid suppression.",
    "SERTRALINE_PM": "Poor CYP2C19 metabolizers may experience higher sertraline levels, increasing risk of dose-dependent side effects.",
    "CITALOPRAM_PM": "Poor CYP2C19 metabolizers accumulate citalopram, increasing QT prolongation risk. Dose should not exceed 20 mg/day.",
    "ESCITALOPRAM_PM": "Poor CYP2C19 metabolizers have elevated escitalopram levels, increasing QT prolongation risk. Maximum dose of 10 mg/day recommended.",
    "DIAZEPAM_PM": "Poor CYP2C19 metabolizers have prolonged diazepam half-life and increased sedation risk.",
    "VORICONAZOLE_PM": "Poor CYP2C19 metabolizers have significantly elevated voriconazole levels, increasing risk of hepatotoxicity and visual disturbances.",
    "CLOBAZAM_PM": "Poor CYP2C19 metabolizers accumulate the active metabolite N-desmethylclobazam, increasing sedation and toxicity risk.",

    # CYP2C9 drugs
    "WARFARIN_PM": "Reduced CYP2C9 activity impairs warfarin clearance, necessitating strictly lower doses to prevent severe bleeding events.",
    "PHENYTOIN_PM": "Poor CYP2C9 metabolizers accumulate phenytoin, risking neurotoxicity (ataxia, nystagmus) and cardiovascular effects.",
    "CELECOXIB_PM": "Reduced CYP2C9 metabolism increases celecoxib exposure, raising cardiovascular and gastrointestinal risk.",
    "IBUPROFEN_PM": "Poor CYP2C9 metabolizers have increased ibuprofen exposure, raising the risk of GI bleeding and renal effects.",
    "MELOXICAM_PM": "Reduced CYP2C9 metabolism increases meloxicam levels, potentially increasing GI and cardiovascular side effects.",
    "LOSARTAN_PM": "Losartan is a prodrug activated by CYP2C9. Poor metabolizers produce less active metabolite (EXP 3174), reducing antihypertensive efficacy.",
    "SIPONIMOD_PM": "CYP2C9 poor metabolizers have markedly increased siponimod exposure. Siponimod is contraindicated in CYP2C9*3/*3 genotype.",

    # SLCO1B1 drugs
    "SIMVASTATIN_PM": "Reduced SLCO1B1 function limits hepatic uptake, causing high plasma levels of simvastatin and high risk of muscle toxicity.",
    "SIMVASTATIN_IM": "Intermediate SLCO1B1 function increases risk of muscle toxicity. Consider lower dose or alternative statin.",
    "ATORVASTATIN_PM": "Reduced SLCO1B1 function increases atorvastatin plasma levels, moderately increasing myopathy risk.",
    "ROSUVASTATIN_PM": "Reduced SLCO1B1 function increases rosuvastatin levels, though myopathy risk is lower than with simvastatin.",
    "LOVASTATIN_PM": "Reduced SLCO1B1 function significantly increases lovastatin exposure and myopathy risk. Consider alternative statin.",
    "METHOTREXATE_PM": "Reduced SLCO1B1 function impairs methotrexate hepatic uptake, increasing systemic toxicity risk including mucositis and myelosuppression.",

    # TPMT drugs
    "AZATHIOPRINE_PM": "Absent TPMT activity causes azathioprine's cytotoxic metabolites to accumulate, potentially causing life-threatening bone marrow suppression.",
    "MERCAPTOPURINE_PM": "TPMT-deficient patients accumulate toxic thioguanine nucleotides from mercaptopurine, leading to severe myelosuppression.",
    "THIOGUANINE_PM": "TPMT deficiency causes thioguanine accumulation, significantly increasing the risk of myelosuppression.",

    # DPYD drugs
    "FLUOROURACIL_PM": "DPYD deficiency prevents fluorouracil breakdown, causing life-threatening toxicity including severe mucositis, diarrhea, and neutropenia.",
    "CAPECITABINE_PM": "Capecitabine is converted to fluorouracil in the body. DPYD deficiency prevents its clearance, causing severe and potentially fatal toxicity.",
    "TEGAFUR_PM": "Tegafur is metabolized to fluorouracil. DPYD-deficient patients cannot clear the drug, leading to severe toxicity.",

    "DEFAULT": "Genetic variants influence drug metabolism and may require dose adjustment. Consult specific CPIC guidelines for dosing."
}

def call_groq_api(drug: str, gene: str, phenotype: str, api_key: str) -> Optional[str]:
    """
    Calls Groq API to generate a patient-friendly explanation.
    """
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        prompt = f"Explain clearly in 2 simple sentences why the drug {drug} might be risky or ineffective for a patient with the {gene} gene phenotype '{phenotype}'. Focus on the biological mechanism but keep it simple."
        
        data = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": "You are a helpful clinical assistant. output only the explanation, no preamble."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 150
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=5)
        
        if response.status_code == 200:
            content = response.json()
            return content["choices"][0]["message"]["content"].strip()
        else:
            print(f"Groq API Error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Groq Request Failed: {e}")
        return None

def get_explanation(drug: str, gene: str, phenotype: str, api_key: Optional[str] = None) -> str:
    """
    Retrieves a deterministic explanation or uses LLM if key is provided.
    """
    
    # 1. Try LLM if Key Provided
    if api_key:
        llm_explanation = call_groq_api(drug, gene, phenotype, api_key)
        if llm_explanation:
            return llm_explanation
        # Fallback to templates if LLM fails
        
    # 2. Try Drug-Phenotype Key
    drug_key = f"{drug.upper()}_{phenotype}"
    if drug_key in EXPLANATION_TEMPLATES:
        return EXPLANATION_TEMPLATES[drug_key]
        
    # 3. Try Gene-Phenotype Key
    gene_key = f"{gene.upper()}_{phenotype}"
    if gene_key in EXPLANATION_TEMPLATES:
        return EXPLANATION_TEMPLATES[gene_key]
        
    # 4. Handle specific formatting differences
    if gene == "SLCO1B1":
         if "PM" in phenotype or "Low" in phenotype:
              if drug.upper() == "SIMVASTATIN":
                   return EXPLANATION_TEMPLATES.get("SIMVASTATIN_PM", EXPLANATION_TEMPLATES["DEFAULT"])
              return EXPLANATION_TEMPLATES.get("SLCO1B1_PM", EXPLANATION_TEMPLATES["DEFAULT"])
         if "IM" in phenotype or "Intermediate" in phenotype:
              if drug.upper() == "SIMVASTATIN":
                   return EXPLANATION_TEMPLATES.get("SIMVASTATIN_IM", EXPLANATION_TEMPLATES["DEFAULT"])
              return EXPLANATION_TEMPLATES.get("SLCO1B1_IM", EXPLANATION_TEMPLATES["DEFAULT"])

    return EXPLANATION_TEMPLATES["DEFAULT"]
