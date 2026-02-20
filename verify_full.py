
import requests
import json

URL = "http://127.0.0.1:8000/api/analyze"
VCF_FILE = "user_query.vcf"

def verify_full_logic():
    with open(VCF_FILE, "rb") as f:
        files = {"vcf_file": (VCF_FILE, f, "text/plain")}
        data = {"drugs": "CODEINE,WARFARIN"}
        response = requests.post(URL, files=files, data=data)
        if response.status_code == 200:
            result = response.json()
            drug_data = result["results"][0]
            ml = drug_data.get("ml_risk_analysis", {})
            
            print("--- Verification Report ---")
            print(f"Drug: {drug_data['drug']}")
            print(f"Prediction: {ml.get('prediction_label')}")
            print(f"Model Type: {ml.get('ml_model_used')}")
            print(f"AUC Score: {ml.get('model_auc_score')}")
            print(f"Features Detected: {list(ml.get('ml_features', {}).keys())}")
            print(f"Alternatives provided: {ml.get('medication_alternatives') is not None}")
            print("---------------------------")
        else:
            print(f"Error: {response.text}")

if __name__ == "__main__":
    verify_full_logic()
