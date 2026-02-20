from typing import List, Dict, Set
import logging

logger = logging.getLogger(__name__)

TARGET_GENES = {"CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"}

def extract_variants(vcf_lines: List[str]) -> Dict[str, Dict[str, List[str]]]:
    """
    Parses validated VCF lines and extracts pharmacogenomic variants grouped by gene.
    
    Args:
        vcf_lines: List of VCF content lines (excluding header).
        
    Returns:
        Dictionary structure:
        {
            "CYP2D6": {
                "alleles": ["*4", "*1"], # Raw list of detected alleles (may include duplicates or *1 if explicit)
                "rsids": ["rs3892097", "rs1065852"]
            }
        }
    """
    extracted_data = {gene: {"variants": [], "alleles": []} for gene in TARGET_GENES}
    
    for line in vcf_lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
            
        # Robust column splitting
        if "\t" in line:
            cols = line.split("\t")
        else:
            cols = line.split()
            
        if len(cols) < 8:
            continue
            
        info_field = cols[7]
        # Parse INFO carefully
        info_dict = {}
        for part in info_field.split(";"):
            if "=" in part:
                k, v = part.split("=", 1)
                info_dict[k] = v
            else:
                info_dict[part] = True
        
        gene = info_dict.get("GENE")
        star_allele = info_dict.get("STAR")
        rsid = info_dict.get("RS")
        
        if gene in TARGET_GENES:
            # Parse GT (Genotype) if available
            is_homozygous = False
            gt_string = None  # Store the raw GT string (e.g. "0/1", "1/1")
            
            if len(cols) >= 10:
                format_col = cols[8]
                sample_col = cols[9]
                if "GT" in format_col:
                    try:
                        format_parts = format_col.split(":")
                        gt_idx = format_parts.index("GT")
                        sample_parts = sample_col.split(":")
                        if len(sample_parts) > gt_idx:
                            gt_value = sample_parts[gt_idx]
                            gt_string = gt_value  # Capture it
                            if gt_value == "1/1" or gt_value == "1|1":
                                is_homozygous = True
                    except ValueError:
                        pass
            
            # Record variant
            if star_allele:
                # We keep a raw list of alleles for diplotype building (legacy support)
                extracted_data[gene]["alleles"].append(star_allele)
                if is_homozygous:
                    extracted_data[gene]["alleles"].append(star_allele)
                
                # Structured variant object for new diplotype builder
                variant_obj = {
                    "allele": star_allele,
                    "rsid": rsid if rsid else "N/A",
                    "gt": gt_string if gt_string else "0/1" # Default to hetero if GT missing/unparsable but variant present
                }
                extracted_data[gene]["variants"].append(variant_obj)
                
                # If homozygous, strictly speaking the physical variant (SNP) is causing both alleles.
                # But "detected_variants" in the report is usually a list of influential SNPs.
                # So listing the RSID once is correct.
                  
    return extracted_data