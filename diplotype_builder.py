from typing import Dict, List


def build_diplotype(
    variants: Dict[str, Dict[str, List[Dict[str, str]]]]
) -> Dict[str, str]:
    """
    Build clinically correct diplotypes using STAR allele + GT field.

    Input format:
    {
        "CYP2D6": {
            "variants": [
                {"allele": "*4", "gt": "0/1"},
                {"allele": "*2", "gt": "0/1"}
            ]
        }
    }

    Output:
    {"CYP2D6": "*2/*4"}
    """

    diplotypes = {}

    BASE_HIGH_RISK = {
        "*3", "*4", "*5", "*6", "*8", "*11",
        "*12", "*13", "*14", "*15"
    }

    BASE_MEDIUM_RISK = {
        "*2", "*9", "*10", "*17", "*41", "*1B"
    }

    for gene, data in variants.items():

        detected_alleles = []

        # -----------------------------
        # ✅ GT-aware allele expansion
        # -----------------------------
        for var in data.get("variants", []):
            allele = var.get("allele")
            gt = var.get("gt")

            if not allele or not gt:
                continue

            if gt == "1/1":
                detected_alleles.extend([allele, allele])

            elif gt in ["0/1", "1/0"]:
                detected_alleles.append(allele)

        # -----------------------------
        # Gene-specific severity copy
        # -----------------------------
        HIGH_RISK = set(BASE_HIGH_RISK)
        MEDIUM_RISK = set(BASE_MEDIUM_RISK)

        if gene in ["CYP2C19", "CYP2C9"]:
            HIGH_RISK.add("*2")
            MEDIUM_RISK.discard("*2")

        # -----------------------------
        # Severity scoring
        # -----------------------------
        def severity_score(allele: str):
            if allele == "*1":
                return 0
            if allele in HIGH_RISK:
                return 10
            if allele in MEDIUM_RISK:
                return 5
            return 2

        # -----------------------------
        # Remove explicit *1
        # -----------------------------
        filtered = [a for a in detected_alleles if a != "*1"]

        # -----------------------------
        # Diplotype logic
        # -----------------------------
        if len(filtered) == 0:
            diplotype = "*1/*1"

        elif len(filtered) == 1:
            diplotype = f"*1/{filtered[0]}"

        else:
            ranked = sorted(
                filtered,
                key=severity_score,
                reverse=True
            )

            diplotype = f"{ranked[0]}/{ranked[1]}"

        # -----------------------------
        # Standard display sorting
        # -----------------------------
        def display_key(a):
            if a == "*1":
                return 999
            digits = ''.join(filter(str.isdigit, a))
            return int(digits) if digits else 999

        parts = diplotype.split("/")
        parts.sort(key=display_key)

        diplotypes[gene] = f"{parts[0]}/{parts[1]}"

    return diplotypes