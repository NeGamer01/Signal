<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# XAUUSD AI Signal Scanner PRO

Aplikasi web tingkat institusional untuk analisis teknikal XAUUSD (Emas) menggunakan Google Gemini AI.

## Fitur Utama
- **Real-time Data**: WebSocket connection ke TwelveData (Forex) & Binance (Crypto).
- **AI Reasoning**: Integrasi Gemini 2.5 Flash / 3.0 Pro untuk analisis sinyal.
- **Advanced Indicators**: Ichimoku Cloud, ADX, Bollinger Bands, RSI, Pivot Points.
- **Visual Strategy**: Overlay Entry, TP, dan SL langsung di chart TradingView.
- **Broker Sync**: Fitur kalibrasi harga untuk menyamakan harga web dengan MT4/Exness.

## Cara Deploy ke Vercel (Gratis)

Aplikasi ini sudah dikonfigurasi agar 100% kompatibel dengan Vercel.

1. **Push ke GitHub**
   - Upload kode project ini ke repository GitHub Anda.

2. **Buka Dashboard Vercel**
   - Login ke [vercel.com](https://vercel.com)
   - Klik "Add New..." -> "Project"
   - Import repository GitHub yang baru Anda buat.

3. **Konfigurasi Environment Variables (PENTING)**
   Di halaman konfigurasi project Vercel ("Configure Project"), cari bagian **Environment Variables**. Masukkan key berikut:

   - **Name**: `GEMINI_API_KEY`
   - **Value**: `[Paste API Key Google Gemini Anda disini]`

   *Catatan: Anda bisa mendapatkan API Key gratis di [aistudio.google.com](https://aistudio.google.com).*

4. **Deploy**
   - Klik tombol **Deploy**.
   - Tunggu proses build selesai (sekitar 1 menit).

5. **Selesai**
   - Aplikasi Anda sekarang live. URL akan diberikan oleh Vercel.
   - Buka aplikasi, masuk ke menu **Settings**, dan pastikan status Server Key menunjukkan "Active".

## Menjalankan Secara Lokal

1. Install dependencies:
   `npm install`
2. Buat file `.env` di root folder dan isi:
   `GEMINI_API_KEY=your_api_key_here`
3. Jalankan aplikasi:
   `npm run dev`
