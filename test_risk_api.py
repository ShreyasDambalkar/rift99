import requests
import json

URL = "http://127.0.0.1:8000/predict-risk"

def test_api():
    payload = {
        "drug_names": "Codeine, Warfarin",
        "phenotype_profile": {
            "CYP2D6": "PM",
            "CYP2C9": "NM"
        }
    }
    
    try:
        resp = requests.post(URL, json=payload)
        if resp.status_code == 200:
            print("✅ API Success")
            print(json.dumps(resp.json(), indent=2))
        else:
            print(f"❌ API Failed: {resp.status_code}")
            print(resp.text)
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_api()
