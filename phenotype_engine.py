import json
import os

# Load phenotype data
DATA_FILE = "gene_phenotypes.json"
PHENOTYPE_DATA = {}

def load_data():
    global PHENOTYPE_DATA
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            PHENOTYPE_DATA = json.load(f)

load_data()

def get_phenotype(gene: str, diplotype: str) -> str:
    """
    Maps a gene and diplotype to a clinical phenotype.
    
    Args:
        gene: e.g. "CYP2D6"
        diplotype: e.g. "*4/*4" or "*1/*4"
        
    Returns:
        Phenotype string (e.g. "PM", "IM") or "Unknown"
    """
    if gene not in PHENOTYPE_DATA:
        return "Unknown"
        
    # Try exact match
    if diplotype in PHENOTYPE_DATA[gene]:
        return PHENOTYPE_DATA[gene][diplotype]
        
    # Try reverse order (*1/*4 vs *4/*1) just in case
    # My builder standardizes it, but safety check.
    parts = diplotype.split("/")
    if len(parts) == 2:
        reversed_dip = f"{parts[1]}/{parts[0]}"
        if reversed_dip in PHENOTYPE_DATA[gene]:
            return PHENOTYPE_DATA[gene][reversed_dip]
            
    return "Unknown"
