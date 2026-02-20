from drug_risk_engine import predict_drug_risks, PhenotypeProfile
import json

def test_risk_prediction():
    print("Testing Drug Risk Prediction Engine...")
    
    # Test Case 1: Codeine with PM (High Risk/Ineffective)
    print("\nTest 1: Codeine (PM)")
    profile_pm = {"CYP2D6": "PM", "CYP2C19": "NM", "CYP2C9": "NM"}
    result = predict_drug_risks("Codeine", profile_pm)
    print(json.dumps(result, indent=2))
    assert result[0]["risk_label"] == "Ineffective"
    assert result[0]["severity"] == "moderate"
    assert result[0]["confidence_score"] == 0.98
    print("✅ Passed Codeine PM")

    # Test Case 2: Warfarin with NM (Safe)
    print("\nTest 2: Warfarin (NM)")
    profile_nm = {"CYP2D6": "NM", "CYP2C9": "NM"}
    result = predict_drug_risks("WARFARIN", profile_nm)
    print(json.dumps(result, indent=2))
    assert result[0]["risk_label"] == "Safe"
    assert result[0]["severity"] == "none"
    print("✅ Passed Warfarin NM")

    # Test Case 3: Multiple Drugs (Codeine, Clopidogrel)
    print("\nTest 3: Multiple Drugs")
    profile_multi = {"CYP2D6": "UM", "CYP2C19": "PM"} 
    # Codeine UM -> Toxic (high)
    # Clopidogrel PM -> Toxic (high)
    result = predict_drug_risks("Codeine, Clopidogrel", profile_multi)
    print(json.dumps(result, indent=2))
    assert len(result) == 2
    assert result[0]["drug"] == "CODEINE" and result[0]["risk_label"] == "Toxic"
    assert result[1]["drug"] == "CLOPIDOGREL" and result[1]["risk_label"] == "Toxic"
    print("✅ Passed Multiple Drugs")

    # Test Case 4: Unknown Drug
    print("\nTest 4: Unknown Drug")
    result = predict_drug_risks("MysteryDrug", profile_nm)
    print(json.dumps(result, indent=2))
    assert result[0]["risk_label"] == "Unknown"
    assert result[0]["confidence_score"] == 0.30
    print("✅ Passed Unknown Drug")
    
    # Test Case 5: Missing Phenotype
    print("\nTest 5: Missing Phenotype")
    # Simvastatin needs SLCO1B1, but we don't provide it
    result = predict_drug_risks("Simvastatin", profile_nm) # profile_nm has no SLCO1B1
    print(json.dumps(result, indent=2))
    assert result[0]["phenotype"] == "Unknown"
    assert result[0]["risk_label"] == "Unknown"
    print("✅ Passed Missing Phenotype")

if __name__ == "__main__":
    test_risk_prediction()
