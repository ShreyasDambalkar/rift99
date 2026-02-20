
import requests
import json

URL = "http://127.0.0.1:8000/api/analyze"
VCF_FILE = "user_query.vcf"

def verify_ml():
    with open(VCF_FILE, "rb") as f:
        files = {"vcf_file": (VCF_FILE, f, "text/plain")}
        data = {"drugs": "CODEINE"}
        response = requests.post(URL, files=files, data=data)
        if response.status_code == 200:
            result = response.json()
            # print(json.dumps(result["results"][0], indent=2))
            if "ml_risk_analysis" in result["results"][0]:
                 print("✅ ML Analysis integrated successfully!")
                 print(f"ML Prediction: {result['results'][0]['ml_risk_analysis']['prediction_label']}")
                 if result['results'][0]['ml_risk_analysis']['medication_alternatives']:
                      print(f"Alternative: {result['results'][0]['ml_risk_analysis']['medication_alternatives'].get('drug')}")
            else:
                 print("❌ ML Analysis field missing!")
        else:
            print(f"❌ API Error: {response.text}")

if __name__ == "__main__":
    verify_ml()
