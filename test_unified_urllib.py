
import urllib.request
import urllib.parse
import json
import sys
import mimetypes
import uuid

# Define the endpoint URL
URL = "http://127.0.0.1:8000/api/analyze"
VCF_FILE = "user_query.vcf"



def test_urllib():
    print(f"Testing {URL} using urllib...")
    
    boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
    
    # Read VCF content
    with open(VCF_FILE, "rb") as f:
        file_content = f.read()
        
    # Construct Body
    body = []
    
    # 1. drugs field
    body.append(f'--{boundary}'.encode())
    body.append(f'Content-Disposition: form-data; name="drugs"'.encode())
    body.append(b'')
    body.append(b'CODEINE,WARFARIN')
    
    # 2. vcf_file field
    body.append(f'--{boundary}'.encode())
    body.append(f'Content-Disposition: form-data; name="vcf_file"; filename="{VCF_FILE}"'.encode())
    body.append(b'Content-Type: text/plain')
    body.append(b'')
    body.append(file_content)
    
    body.append(f'--{boundary}--'.encode())
    body.append(b'')
    
    payload = b'\r\n'.join(body)
    
    req = urllib.request.Request(URL, data=payload)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            response_body = response.read().decode('utf-8')
            
            print(f"Status Code: {status_code}")
            
            if status_code == 200:
                result = json.loads(response_body)
                print(json.dumps(result, indent=2))
                
                results_list = result.get("results", [])
                if not results_list:
                     print("❌ No results returned")
                     sys.exit(1)
                     
                codeine = next((r for r in results_list if r["drug"] == "CODEINE"), None)
                if codeine:
                    # Check Schema Presence
                    required_keys = ["patient_id", "timestamp", "risk_assessment", "pharmacogenomic_profile", "clinical_recommendation", "llm_generated_explanation", "quality_metrics"]
                    missing_keys = [k for k in required_keys if k not in codeine]
                    if missing_keys:
                        print(f"❌ Missing Schema Keys: {missing_keys}")
                    else:
                        print("✅ Schema Keys Present")

                    risk = codeine["risk_assessment"]["risk_label"]
                    print(f"✅ Codeine Risk: {risk}")
                    if risk == "Ineffective":
                        print("✅ Correct Risk Found")
                    else:
                        print(f"❌ Unexpected Risk: {risk}")

                    expl = codeine["llm_generated_explanation"]["summary"]
                    # Flexible check: Template has "Poor metabolizers", LLM might vary but usually mentions "prodrug" or "metabolism"
                    if "Poor metabolizers" in expl or "prodrug" in expl.lower() or "metabolism" in expl.lower(): 
                        print(f"✅ Explanation Check Passed: {expl[:50]}...")
                    else:
                        print(f"❌ Unexpected Explanation: {expl}")
                        
                    # Quality Metrics Check
                    qm = codeine["quality_metrics"]
                    if qm.get("vcf_parsing_success") is True and qm.get("gene_found") is True:
                         print("✅ Quality Metrics Valid")
                    else:
                         print(f"❌ Invalid Quality Metrics: {qm}")
                         
            else:
                print(f"❌ Failed: {response_body}")
                
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error: {e.code}")
        print(e.read().decode())
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_urllib()
