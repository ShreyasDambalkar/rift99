# PharmaGuard VCF Authenticator 🧬

**Secure Pharmacogenomic Analysis & Real-Time Risk Assessment Platform**

PharmaGuard is a comprehensive pharmacogenomics (PGx) platform designed to analyze patient genetic data (VCF files) and predict drug-gene interactions. It leverages a dual-engine approach combining clinical guidelines (CPIC) with machine learning to provide accurate medication safety assessments.

## 🚀 Key Features

### 🔬 Advanced Genetic Analysis
- **VCF File Processing**: Supports standard VCF v4.2 uploads with validation for required pharmacogenomic tags (GENE, RS, STAR).
- **Automated Profiling**: Extracts key variants, builds diplotypes, and determines phenotypes for critical pharmacogenes:
  - `CYP2D6` (Codeine, Tamoxifen)
  - `CYP2C19` (Clopidogrel, Omeprazole)
  - `CYP2C9` (Warfarin, Phenytoin)
  - `SLCO1B1` (Simvastatin)
  - `TPMT` (Thiopurines)
  - `DPYD` (Fluorouracil)

### 🧠 Dual-Engine Risk Assessment
1. **Rule-Based Clinical Engine**: Implements CPIC guidelines for deterministic, evidence-based risk profiling.
2. **ML Ensemble Predictor**: Analyzes variant density, impact, and pathogenicity to predict general medication risks with confidence scores.

### 👥 Role-Based Dashboards
- **Patient Portal**: 
  - Upload VCF files securely.
  - View simplified "Traffic Light" risk reports (Green/Yellow/Red).
  - Access history of previous analyses.
  - Real-time chat with assigned clinicians.
- **Doctor Portal**: 
  - Manage multiple patients.
  - View detailed genetic breakdowns (Variant details, Star Alleles).
  - Override or confirm automated risk assessments.
  - Provide alternative medication recommendations.

### 💬 Real-Time Consultation
- Integrated **WebSocket-based Chat** allows immediate communication between patients and doctors to discuss results and medication adjustments.

### 🎙️ Voice-Activated Drug Consultant (ElevenLabs)
- **Interactive Voice Agent**: Patients can call an AI-powered agent for real-time consultation.
- **Seamless Verification**: The agent authenticates the patient via their Patient ID.
- **Context-Aware Analysis**:  
  1. Retrieves the patient's existing VCF file.  
  2. Accepts the drug name provided verbally by the patient.  
  3. Converts the voice query into actionable data.  
  4. Runs the validation rules and pharmacogenomic analysis instantly.  
- **Verbal Guidance**: The AI speaks back to the patient, advising whether the medication is safe or suggesting an alternative based on their genetic profile.

### 🤖 AI-Powered Insights
- **LLM Explanations**: Generates patient-friendly explanations for complex genetic risks using the Groq API.
- **Alternative Suggestions**: Automatically suggests safer medication alternatives for high-risk drugs based on the patient's specific genetic profile.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Data Processing**: Pandas, NumPy
- **Machine Learning**: Scikit-Learn (Ensemble Models), Joblib
- **Real-time**: WebSockets

### Frontend
- **Framework**: React 19 (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios

### Infrastructure
- **Database & Auth**: Supabase
- **LLM Integration**: Groq API

---

## 📂 Project Structure

```
vcf-authenticator/
├── vcf_authenticator.py       # Main Backend Application & API Endpoints
├── drug_risk_engine.py        # Rule-based risk assessment logic
├── phenotype_engine.py        # Gene phenotype determination logic
├── variant_extractor.py       # VCF parsing and variant extraction
├── diplotype_builder.py       # Star allele diplotype construction
├── requirements.txt           # Python dependencies
├── vcf_feature_extractor/     # Machine Learning Module
│   ├── extractor.py           # Feature extraction for ML models
│   └── models/                # Serialized model files (.pkl)
└── frontend/                  # React Frontend Application
    ├── src/
    │   ├── pages/             # Dashboard and Public pages
    │   ├── components/        # Reusable UI components
    │   ├── lib/               # Utilities
    └   └── ...
```

---

## ⚡ Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- Supabase Account
- Groq API Key

### 1. Backend Setup

```bash
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
touch .env
```

**Add the following to your `.env` file:**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
```

**Run the Backend:**
```bash
uvicorn vcf_authenticator:app --reload
```
The API will be available at `http://localhost:8000`.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
The Frontend will be available at `http://localhost:5173`.

---

## 📖 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/analyze` | upload VCF file and drug list for full analysis |
| `POST` | `/predict-risk` | Get risk prediction for a specific phenotype profile |
| `POST` | `/validate-vcf` | Validate VCF file format and contents |
| `POST` | `/api/chat/send` | Send a chat message (persisted to DB) |
| `WS` | `/ws/chat/{id}` | WebSocket connection for real-time updates |

---

## 🔒 Security & Privacy

- **Local Validation**: Initial VCF validation happens via streaming to ensure file integrity.
- **Secure Storage**: Chat messages and user data are stored in Supabase with Row Level Security (RLS).
- **Anonymization**: The analysis pipeline is designed to process phenotypic data without storing raw genomic files permanently.

---

## 🧪 Testing

To run the backend test suite:

```bash
python -m pytest
```

---

*Built for the Future of Personalized Medicine.*
