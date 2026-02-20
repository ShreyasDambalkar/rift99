# VCF Feature Extraction Algorithm

This document explains the logic used to transform raw genomic data (VCF) into numerical features for the Drug Risk Assessment Ensemble Model.

## 1. Working Mechanism

The algorithm follows a three-stage pipeline: **Parse -> Filter -> Aggregate.**

### Stage 1: Parsing (INFO Decomposition)
The algorithm reads the VCF's 8th column (`INFO`). It uses Regular Expressions (Regex) to pull out specific metadata required for clinical assessment:
*   **Gene Name (`Gene=`):** Identifies which protein the variant affects.
*   **Impact (`IMPACT=`):** Categorizes the functional disruption (e.g., HIGH, MODERATE, LOW).
*   **Clinical Significance (`CLNSIG=`):** Maps to ClinVar data (e.g., Pathogenic, Benign).

### Stage 2: Contextual Filtering (Drug-Gene Mapping)
Not every variant in a VCF matters for every drug. The algorithm applies a **Genetic Context Filter**:
*   It looks up the primary metabolizing genes for the requested drug (e.g., if the drug is *Warfarin*, it focuses on `CYP2C9` and `VKORC1`).
*   Only variants within these genes or those explicitly tagged with the drug name are passed to the aggregation stage.

### Stage 3: Feature Aggregation (Numerical Encoding)
The filtered variants are compressed into a single numerical vector (the "Feature Set").

---

## 2. Feature Definitions

The following features were extracted from the **DrugRiskML** project as the most predictive metrics:

| Feature Name | Description | Rationale |
| :--- | :--- | :--- |
| `VARIANT_COUNT` | Total number of filtered variants. | Measures the overall genomic load in target genes. |
| `HIGH_RISK_VARIANTS` | Sum of `High Impact` + `Pathogenic` variants. | Directly correlates with severe adverse drug reactions. |
| `VARIANT_DENSITY` | Total variants divided by a normalization factor (1000). | Accounts for data scale across different VCF sizes. |
| `UNIQUE_GENES` | Count of unique genes affected. | Helps identify multi-pathway inheritance risks. |
| `PATHOGENIC_VARIANTS`| Specifically counts variants marked as clinical "Pathogens". | High weight in clinical recommendation engines. |
| `DRUG_RISK_RATIO` | `HIGH_RISK_VARIANTS` / `VARIANT_COUNT` | Represents the "purity" of the risk (how much of the data is actually dangerous). |
| `RISK_SCORE_SQUARED` | (`DRUG_RISK_RATIO`)^2 | Captures non-linear risk escalation in ensemble models. |

---

## 3. The Algorithm Summary

## 4. Integrated Machine Learning Model

The folder now includes the pre-trained **Ensemble ML Model** (XGBoost + Random Forest + Logistic Regression) used in the original project.

### Model Components (in `/models`):
*   **`ensemble_model.pkl`**: The core binary containing the trained decision logic.
*   **`ensemble_scaler.pkl`**: The Standard Scaler used to normalize features before they enter the model.
*   **`ensemble_metadata.json`**: Technical metadata about the model version and training date.

### How to Predict:
The `extractor.py` has been updated with a `predict_risk()` method. This method:
1.  Extracts the features listed above.
2.  Normalizes them using the `ensemble_scaler`.
3.  Returns a classification (HIGH, MODERATE, LOW) based on the model's confidence probability.

```python
result = extractor.predict_risk(vcf_text, "Clopidogrel")
print(result['risk_level']) # Output: HIGH, MODERATE, or LOW
```
