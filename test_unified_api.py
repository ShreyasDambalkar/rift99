
import requests
import json
import sys

# Define the endpoint URL
URL = "http://127.0.0.1:8000/api/analyze"

# Path to the VCF file we created earlier
VCF_FILE = "user_query.vcf"

def test_analyze_endpoint():
    print(f"Testing {URL} with {VCF_FILE}...")
    
    try:
        with open(VCF_FILE, "rb") as f:
            files = {"vcf_file": (VCF_FILE, f, "text/plain")}
            data = {"drugs": "CODEINE,WARFARIN,SIMVASTATIN"}
            
            response = requests.post(URL, files=files, data=data)
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(json.dumps(result, indent=2))
                
                # Assertions
                results_list = result.get("results", [])
                if not results_list:
                    print("❌ No results returned!")
                    sys.exit(1)
                
                codeine = next((r for r in results_list if r["drug"] == "CODEINE"), None)
                if codeine:
                    risk = codeine["risk_assessment"]["risk_label"]
                    print(f"✅ Codeine Risk: {risk}")
                    if risk == "Ineffective":
                        print("✅ Codeine correctly identified as Ineffective (PM)")
                    else:
                         print(f"❌ Unexpected Codeine Risk: {risk}")
                         
                    # Check Explanation
                    explanation = codeine["llm_generated_explanation"]["summary"]
                    if "Poor metabolizers cannot convert codeine" in explanation:
                        print("✅ Codeine Explanation matches rule")
                    else:
                        print(f"❌ Unexpected Explanation: {explanation}")

                return True
            else:
                print("❌ Request failed")
                print(response.text)
                return False
                
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_analyze_endpoint()
