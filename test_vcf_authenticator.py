import requests
import asyncio
import uvicorn
import multiprocessing
import time
import os
from vcf_authenticator import app

# We need to run the app in a separate process for testing with requests, 
# or use TestClient from fastapi.testclient.
# Since we didn't add httpx/TestClient to requirements explicitly (only requests),
# we can use TestClient if installed (Starlette requires it or similar), but simpler to just use TestClient.
# Wait, TestClient requires httpx. I didn't add httpx.
# I'll add httpx to requirements or assume it's available or use requests against a subprocess.
# Let's use requests against a subprocess to be safe with the environment I defined.

HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}/validate-vcf"

def run_server():
    uvicorn.run(app, host=HOST, port=PORT, log_level="error")

def create_dummy_vcf(filename, size_kb=2, valid=True, missing_header=False, malformed_variant=False, no_genes=False, missing_annotations=False):
    # Header
    content = "##fileformat=VCFv4.2\n"
    content += "##INFO=<ID=GENE,Number=1,Type=String,Description=\"Gene Name\">\n"
    content += "##INFO=<ID=RS,Number=1,Type=String,Description=\"dbSNP ID\">\n"
    content += "##INFO=<ID=STAR,Number=1,Type=String,Description=\"Star Allele\">\n"
    if not missing_header:
        content += "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
    else:
        content += "#CHROM_BAD\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"

    # Variants
    # Need > 10 variants for valid file
    # Genes: CYP2D6
    
    for i in range(50):
        chrom = "chr1"
        pos = 1000 + i
        vid = f"rs{pos}"
        ref = "A"
        alt = "G"
        qual = "."
        filt = "PASS"
        
        if malformed_variant and i == 5:
            # Create bad line
            line = f"{chrom}\tBAD_POS\t{vid}\t{ref}\t{alt}\t{qual}\t{filt}\tGENE=CYP2D6;RS={vid};STAR=*1\n"
        elif missing_annotations and i == 5:
            # Missing RS/STAR
            line = f"{chrom}\t{pos}\t{vid}\t{ref}\t{alt}\t{qual}\t{filt}\tGENE=CYP2D6\n"
        elif no_genes:
            line = f"{chrom}\t{pos}\t{vid}\t{ref}\t{alt}\t{qual}\t{filt}\tGENE=OTHERGENE;RS={vid};STAR=*1\n"
        else:
            line = f"{chrom}\t{pos}\t{vid}\t{ref}\t{alt}\t{qual}\t{filt}\tGENE=CYP2D6;RS={vid};STAR=*1\n"
            
        content += line
        
    with open(filename, "w") as f:
        f.write(content)

def test_authenticator():
    print("Starting server...")
    proc = multiprocessing.Process(target=run_server)
    proc.start()
    time.sleep(3) # Wait for startup
    
    try:
        # Test 1: Valid VCF
        create_dummy_vcf("test_valid.vcf", valid=True)
        with open("test_valid.vcf", "rb") as f:
            resp = requests.post(URL, files={"file": f})
        print(f"Test 1 (Valid): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 200
        assert resp.json()["valid"] is True
        
        # Test 2: Invalid Extension
        with open("test_valid.vcf", "rb") as f: # content is valid but name is text
            resp = requests.post(URL, files={"file": ("test.txt", f)})
        print(f"Test 2 (Ext): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 400
        assert resp.json()["error_type"] == "InvalidExtension"

        # Test 3: Invalid Header
        create_dummy_vcf("test_bad_header.vcf", missing_header=True)
        with open("test_bad_header.vcf", "rb") as f:
            resp = requests.post(URL, files={"file": f})
        print(f"Test 3 (Header): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 400
        assert "Invalid VCF header" in resp.json()["message"]

        # Test 4: Malformed Variant (POS not integer)
        create_dummy_vcf("test_malformed.vcf", malformed_variant=True)
        with open("test_malformed.vcf", "rb") as f:
            resp = requests.post(URL, files={"file": f})
        print(f"Test 4 (Malformed): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 400
        assert "Malformed variant" in resp.json()["message"]

        # Test 5: No Pharmacogenes
        create_dummy_vcf("test_no_genes.vcf", no_genes=True)
        with open("test_no_genes.vcf", "rb") as f:
            resp = requests.post(URL, files={"file": f})
        print(f"Test 5 (No Genes): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 400
        assert resp.json()["error_type"] == "NoPharmacogenes"

        # Test 6: Missing Annotations
        # In my logic, if even one is missing RS/STAR, does it fail? 
        # The logic: `if not (seen_gene_tag and seen_rs_tag and seen_star_tag):` -> Checks if tags appear AT ALL in file.
        # My test creates 14 valid lines and 1 invalid line. So it SHOULD pass global check if logic is just "seen at least once".
        # If I want to fail, I should make ALL missing?
        # The logic is: seen_gene_tag = True if ANY line has it.
        # So "test_no_genes.vcf" has GENE=OTHERGENE, so seen_gene_tag=True. But pharmacogene_count=0 -> Fails NoPharmacogenes.
        # Test 6: Make a file where NO line has RS tag.
        
        # Let's verify strict annotation:
        # If I create a file with GENE=CYP2D6 but NO RS tag in entire file.
        content = "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        for i in range(50):
             content += f"chr1\t{1000+i}\trs{1000+i}\tA\tG\t.\tPASS\tGENE=CYP2D6;STAR=*1\n"
        with open("test_missing_annot.vcf", "w") as f: f.write(content)
        
        with open("test_missing_annot.vcf", "rb") as f:
            resp = requests.post(URL, files={"file": f})
        print(f"Test 6 (Missing Annot): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 400
        assert resp.json()["error_type"] == "MissingAnnotations"

        # Test 7: Too Small
        with open("test_small.vcf", "w") as f: f.write("##fileformat=VCFv4.2\n") # 20 bytes
        with open("test_small.vcf", "rb") as f:
            resp = requests.post(URL, files={"file": f})
        print(f"Test 7 (Too Small): {resp.status_code} - {resp.json()}")
        assert resp.status_code == 400
        # Either insufficient data or file too small depending on check order/size.
        # My code checks min size at end. But variants < 10 will likely trigger first or size check.
        
        print("\nAll tests passed!")
        
    finally:
        proc.terminate()
        # Clean up
        for f in ["test_valid.vcf", "test_bad_header.vcf", "test_malformed.vcf", "test_no_genes.vcf", "test_missing_annot.vcf", "test_small.vcf"]:
            if os.path.exists(f): 
                try: os.remove(f) 
                except: pass

if __name__ == "__main__":
    test_authenticator()
