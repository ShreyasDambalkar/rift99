from extractor import VCFFeatureExtractor
import os

# 1. Initialize the extractor
# It will look for models in the 'models' subfolder by default
extractor = VCFFeatureExtractor(model_dir=os.path.join(os.path.dirname(__file__), "models"))

# 2. Sample VCF Content
# High-risk example: Pathogenic variant in CYP2C19 (relevant to Clopidogrel)
vcf_content = """##fileformat=VCFv4.2
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO
1\t55019032\t.\tT\tC\t100\tPASS\tGene=CYP2C19;IMPACT=HIGH;CLNSIG=Pathogenic
1\t55019035\t.\tG\tA\t100\tPASS\tGene=ABC;IMPACT=LOW;CLNSIG=Benign
"""

target_drug = "Clopidogrel"

# 3. Perform Prediction
# This method extracts features AND runs them through the Machine Learning model
print(f"--- Running Prediction for {target_drug} ---")
result = extractor.predict_risk(vcf_content, target_drug)

if "error" in result:
    print(f"Error: {result['error']}")
else:
    print(f"Risk Level: {result['risk_level']}")
    print(f"Probability: {result['probability']:.4f}")
    
    # NEW: Alternative drug recommendation feature
    if result["recommendation"]:
        print("\n--- ALTERNATIVE MEDICATION SUGGESTION ---")
        rec = result["recommendation"]
        print(f"Suggested Alternative: {rec['drug']}")
        print(f"Reason: {rec['reason']}")
        print(f"Clinical Evidence: {rec['evidence']}")
        print(f"Recommended Dosage: {rec['dosage']}")
    
    print("\n--- Extracted Features ---")
    for key, value in result['features'].items():
        print(f"{key}: {value}")

# These results can be used directly in your project's clinical decision support flow.
