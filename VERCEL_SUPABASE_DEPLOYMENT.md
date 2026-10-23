# 🚀 Shiv Shakti HP Gas ERP — Vercel + Supabase Deployment Guide

यह गाइड आपको प्रोजेक्ट को **Supabase (PostgreSQL Database)** और **Vercel (Serverless Hosting)** पर **GitHub** के ज़रिए लाइव डिप्लॉय करने का पूरा प्रोसेस स्टेप-बाय-स्टेप समझाती है।

---

## 📋 Table of Contents
1. [Supabase Setup (डेटाबेस तैयार करना)](#1-supabase-setup)
2. [Vercel Setup & Environment Variables](#2-vercel-setup)
3. [GitHub Push Commands (कोड GitHub पर भेजना)](#3-github-push-commands)
4. [Live System Login & Verification](#4-login--verification)

---

## 1. Supabase Setup (डेटाबेस तैयार करना)

1. [https://supabase.com](https://supabase.com) पर जाएं और लॉगिन/साइन अप करें।
2. **New Project** पर क्लिक करें:
   - **Name**: `shiv-shakti-hp-gas-erp` (या अपनी पसंद का नाम)
   - **Database Password**: एक सुरक्षित पासवर्ड चुनें और इसे याद रखें या सुरक्षित जगह नोट कर लें।
   - **Region**: `South Asia (Mumbai)` या अपने नज़दीक का रीजन चुनें।
3. प्रोजेक्ट बनने के बाद:
   - बाएँ मेन्यू से **Project Settings** (नीचे गियर आइकन ⚙️) पर जाएं।
   - **Database** टैब पर क्लिक करें।
   - **Connection Pooling** सेक्शन में जाएं:
     - **Mode**: `Transaction` या `Session` चुनें (Port: `6543` या `5432`)
     - **Connection String** -> **URI** कॉपी करें।
     - उदाहरण:
       ```
       postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
       ```
     - *(नोट: `[YOUR-PASSWORD]` को अपने असली डेटाबेस पासवर्ड से बदलें)*।

### (वैकल्पिक) SQL Schema सीधे Run करना:
अगर आप डेटाबेस टेबल और शुरुआती डेटा (Admin, Hawkers, Items, Settings) तुरंत लोड करना चाहते हैं:
- Supabase डैशबोर्ड में बाएँ मेन्यू से **SQL Editor** पर जाएं।
- **New Query** खोलें।
- प्रोजेक्ट की `supabase_schema.sql` फाइल के सभी कोड को कॉपी करके वहाँ पेस्ट करें।
- **Run** (Ctrl + Enter) दबाएं।
*(नोट: अगर आप ऐसा नहीं भी करते हैं, तो प्रोजेक्ट का कोड पहली बार चलने पर ऑटोमैटिकली टेबल्स बना लेता है)*।

---

## 2. Vercel Setup (प्रोजेक्ट डिप्लॉय करना)

1. [https://vercel.com](https://vercel.com) पर जाएं और अपने GitHub अकाउंट से लॉगिन करें।
2. **Add New...** -> **Project** पर क्लिक करें।
3. अपने GitHub रिपॉजिटरी (`RojnamchaErp-Php` या आपका नया रेपो) को **Import** करें।
4. **Configure Project** स्क्रीन पर:
   - **Framework Preset**: `Other` रहने दें।
   - **Root Directory**: `./` (खाली रहने दें)।
   - **Environment Variables** सेक्शन खोलें और निम्न वेरिएबल जोड़ें:
     - **Name**: `DATABASE_URL`
     - **Value**: आपका Supabase Pooler Connection String:
       ```
       postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
       ```
     - *(या अलग-अलग वेरिएबल्स दे सकते हैं: `DB_DRIVER=pgsql`, `DB_HOST=...`, `DB_PORT=6543`, `DB_USER=...`, `DB_PASS=...`, `DB_NAME=postgres`, `DB_SSLMODE=require`)*
5. **Deploy** बटन पर क्लिक करें!
6. 1 से 2 मिनट में Vercel आपका प्रोजेक्ट लाइव कर देगा और आपको एक लाइव डोमेन लिंक मिलेगा (जैसे: `https://your-project.vercel.app`).

---

## 3. GitHub Push Commands (कोड GitHub पर भेजना)

अगर आप इसी मौजूदा रिपॉजिटरी पर कोड पुश करना चाहते हैं:
```bash
git add .
git commit -m "Configure project for Vercel deployment and Supabase PostgreSQL database"
git push origin master
```

### अगर आपको किसी नए GitHub रिपॉजिटरी पर पुश करना है:
1. GitHub पर नया रिपॉजिटरी बनाएं (उदा. `https://github.com/<username>/<repo-name>.git`).
2. टर्मिनल में निम्नलिखित कमांड्स चलाएं:
```bash
# पुराना रिमोट हटाकर नया रिमोट जोड़ें
git remote set-url origin https://github.com/<username>/<repo-name>.git

# सभी बदलाव स्टेज और कमिट करें
git add .
git commit -m "Initial commit for Vercel and Supabase"

# नई रिपॉजिटरी पर पुश करें
git branch -M main
git push -u origin main
```

---

## 4. Login & Verification

डिप्लॉय होने के बाद Vercel URL खोलें:
- **Default Username**: `admin`
- **Default Password**: `Admin@12345`

सिस्टम पहले लॉगिन पर नया पासवर्ड बदलने का प्रॉम्प्ट देगा।
लॉगिन करते ही आपका पूरा ERP + POS + CRM + Rojnamcha सिस्टम Supabase PostgreSQL के साथ क्लाउड पर बिना किसी रुकावट के काम करेगा!
