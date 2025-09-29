import React, { useState } from 'react';
import Header from './components/Header';
import InputField from './components/InputField';
import TextAreaField from './components/TextAreaField';
import SelectField from './components/SelectField';
import CheckboxField from './components/CheckboxField';
import { courts } from './data/courts';
import { PenetapanData, MembacaOptions } from './types';
import { generatePenetapanText, exportToDocx } from './services/wordGenerator';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

function App() {
  const [formData, setFormData] = useState<PenetapanData>({
    jenisDokumen: 'Penetapan',
    jenisPenetapan: 'Penetapan Aanmaning',
    jenisBeritaAcara: '',
    courtName: 'Pengadilan Negeri Bandung (PN Bdg)',
    determinationDate: new Date().toISOString().split('T')[0],
    judgeName: '',
    clerkName: '',
    jenisPerkara: 'Putusan Perdata Umum (Pdt.Eks)',
    nomorPerkara: '',
    pemohonEksekusi: '',
    alamatPemohonEksekusi: '',
    termohonEksekusi: '',
    alamatTermohonEksekusi: '',
    nomorPutusanPertama: '',
    tanggalPutusanPertama: '',
    amarPutusanPertama: '',
    nomorPutusanBanding: '',
    tanggalPutusanBanding: '',
    amarPutusanBanding: '',
    nomorPutusanKasasi: '',
    tanggalPutusanKasasi: '',
    amarPutusanKasasi: '',
    nomorPutusanPK: '',
    tanggalPutusanPK: '',
    amarPutusanPK: '',
    nomorSurat: '',
    tanggalSurat: '',
    namaKuasa: '',
    alamatKuasa: '',
    tanggalSuratKuasa: '',
    membaca: {
      suratPermohonan: false,
      putusanPertama: false,
      putusanBanding: false,
      putusanKasasi: false,
      putusanPK: false,
      berkasPerkara: false,
    },
    menimbang: '',
    mengingat: '',
    menetapkan: '',
    tembusan: '',
    isProdeo: false,
  });

  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked, name } = e.target as HTMLInputElement;
        if (name in formData.membaca) {
            setFormData(prev => ({ 
                ...prev, 
                membaca: {
                    ...prev.membaca,
                    [name]: checked
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: checked }));
        }
    } else {
        if (name === 'jenisDokumen') {
            setFormData(prev => ({
                ...prev,
                [name]: value as PenetapanData['jenisDokumen'],
                jenisPenetapan: value === 'Penetapan' ? 'Penetapan Aanmaning' : '',
                jenisBeritaAcara: value === 'Berita Acara' ? 'Berita Acara Aanmaning' : '',
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1); // Process only the first page
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (!context) {
        throw new Error("Tidak dapat membuat konteks kanvas.");
      }
      
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

      const infoSchema = {
          type: Type.OBJECT,
          properties: {
              nomorPerkara: { type: Type.STRING },
              pemohonEksekusi: { type: Type.STRING },
              alamatPemohonEksekusi: { type: Type.STRING },
              termohonEksekusi: { type: Type.STRING },
              alamatTermohonEksekusi: { type: Type.STRING },
              nomorPutusanPertama: { type: Type.STRING },
              tanggalPutusanPertama: { type: Type.STRING },
              amarPutusanPertama: { type: Type.STRING },
              nomorPutusanBanding: { type: Type.STRING },
              tanggalPutusanBanding: { type: Type.STRING },
              amarPutusanBanding: { type: Type.STRING },
              nomorPutusanKasasi: { type: Type.STRING },
              tanggalPutusanKasasi: { type: Type.STRING },
              amarPutusanKasasi: { type: Type.STRING },
              nomorPutusanPK: { type: Type.STRING },
              tanggalPutusanPK: { type: Type.STRING },
              amarPutusanPK: { type: Type.STRING },
          }
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64ImageData } },
            { text: "Anda adalah asisten hukum ahli. Analisis gambar dokumen 'Penetapan Aanmaning' ini dan ekstrak semua field yang relevan dengan 'Informasi Perkara'. Jika suatu informasi tidak ditemukan, kembalikan string kosong. Untuk tanggal, gunakan format YYYY-MM-DD." },
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: infoSchema,
        },
      });

      const extractedData = JSON.parse(response.text);
      setFormData(prev => ({...prev, ...extractedData}));

    } catch (err) {
      if (err instanceof Error) {
        setError(`Gagal memproses PDF: ${err.message}`);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui saat memproses PDF.');
      }
    } finally {
      setIsParsingPdf(false);
      // Reset file input to allow re-upload of the same file
      e.target.value = '';
    }
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setGeneratedText('');

    try {
      const result = await generatePenetapanText(formData);
      setGeneratedText(result);
    } catch (err) {
      if (