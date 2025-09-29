import React, { useState, useEffect, useRef } from 'react';
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
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.5.136/build/pdf.worker.mjs';

const steps = [
    { id: 1, name: 'Informasi Dokumen', description: 'Pilih jenis dan detail dasar' },
    { id: 2, name: 'Informasi Perkara', description: 'Isi data para pihak' },
    { id: 3, name: 'Detail Putusan', description: 'Masukkan riwayat putusan' },
    { id: 4, name: 'Substansi & Ekspor', description: 'Atur isi dan hasilkan dokumen' },
];

function App() {
  const [formData, setFormData] = useState<PenetapanData>({
    jenisDokumen: 'Penetapan',
    jenisPenetapan: 'Penetapan Aanmaning',
    jenisBeritaAcara: '',
    courtName: 'Pengadilan Negeri Bandung (PN Bdg)',
    determinationDate: new Date().toISOString().split('T')[0],
    judgeName: 'Wahyu Iman Santoso, S.H., M.H.',
    clerkName: 'Nurhayani Butar Butar, S.H.',
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
      suratPermohonan: true,
      putusanPertama: true,
      putusanBanding: false,
      putusanKasasi: false,
      putusanPK: false,
      berkasPerkara: true,
    },
    menimbang: '',
    mengingat: '',
    menetapkan: '',
    tembusan: '',
    namaJurusita: 'Rahmat Hidayat, S.H.',
    pihakHadir: '',
    isiBeritaAcara: '',
    namaSaksi1: '',
    namaSaksi2: '',
    tanggalSidangBerikutnya: '',
    waktuSidangBerikutnya: '10:00',
    aanmaningSelesai: false,
    isProdeo: false,
  });

  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Automatically set next hearing date for Aanmaning BA, if not marked as finished
    if (formData.jenisBeritaAcara === 'Berita Acara Aanmaning' && formData.determinationDate && !formData.aanmaningSelesai) {
      const date = new Date(formData.determinationDate);
      date.setDate(date.getDate() + 7);
      const nextHearingDate = date.toISOString().split('T')[0];
      if (formData.tanggalSidangBerikutnya !== nextHearingDate) {
        setFormData(prev => ({
          ...prev,
          tanggalSidangBerikutnya: nextHearingDate
        }));
      }
    }
  }, [formData.determinationDate, formData.jenisBeritaAcara, formData.aanmaningSelesai]);


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
              nomorSurat: { type: Type.STRING },
              tanggalSurat: { type: Type.STRING },
              namaKuasa: { type: Type.STRING },
              alamatKuasa: { type: Type.STRING },
              tanggalSuratKuasa: { type: Type.STRING },
          }
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64ImageData } },
            { text: "Anda adalah asisten hukum ahli. Analisis gambar dokumen hukum ini dan ekstrak semua field yang relevan. Pastikan Anda mengikuti aturan-aturan penting berikut:\n1.  **Nomor Perkara Eksekusi ('nomorPerkara'):** Identifikasi dan ekstrak nomor perkara yang secara spesifik mengandung 'Pdt.Eks'.\n2.  **Tanggal Surat Permohonan ('tanggalSurat'):** Cari frasa seperti 'Surat permohonan tanggal ...' dan ekstrak tanggal lengkapnya. Contohnya, dari 'Surat permohonan tanggal 24 Juni 2024', Anda harus mengekstrak tanggal '24 Juni 2024'.\n3.  **Nama dan Alamat Kuasa ('namaKuasa', 'alamatKuasa'):** Cari frasa yang cocok dengan pola 'yang diajukan oleh: [Nama Kuasa], beralamat di [Alamat Kuasa], selaku kuasa ...'. Ekstrak nama dan alamat lengkap dari pola ini. Contoh: dari frasa '...diajukan oleh: AA SUTARSA, S.H., M.H., ... pada SUTARSALAGA Law Office, beralamat di Komplek Pemda Cingised Blok C No. 22 Kota Bandung, selaku kuasa ...', ekstrak 'AA SUTARSA, S.H., M.H., ... pada SUTARSALAGA Law Office' sebagai `namaKuasa` dan 'Komplek Pemda Cingised Blok C No. 22 Kota Bandung' sebagai `alamatKuasa`.\n4.  **Tanggal Surat Kuasa ('tanggalSuratKuasa'):** Cari frasa yang cocok dengan pola 'berdasarkan Surat Kuasa tanggal ...'. Ekstrak tanggal lengkap dari pola ini. Contoh: dari frasa 'berdasarkan Surat Kuasa tanggal 3 Juni 2024, sebagai PEMOHON EKSEKUSI', ekstrak '3 Juni 2024' sebagai `tanggalSuratKuasa`.\nJika ada informasi yang tidak dapat ditemukan, kembalikan string kosong untuk field tersebut.\nUntuk semua tanggal yang diekstrak, format hasilnya menjadi YYYY-MM-DD." },
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: infoSchema,
        },
      });

      const extractedData = JSON.parse(response.text);
      setFormData(prev => ({...prev, ...extractedData}));
      // Move to next step after successful parsing
      setCurrentStep(3);

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
    resultRef.current?.scrollTo(0, 0);

    try {
      const result = await generatePenetapanText(formData);
      setGeneratedText(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Gagal menghasilkan teks: ${err.message}`);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui saat menghasilkan teks.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!generatedText) {
      setError("Tidak ada teks untuk diekspor. Silakan buat dokumen terlebih dahulu.");
      return;
    }
    const docType = formData.jenisDokumen.replace(/\s/g, '_');
    const caseNumber = formData.nomorPerkara.replace(/[/.]/g, '_');
    const fileName = `${docType}_${caseNumber}.docx`;
    exportToDocx(generatedText, fileName);
  };
  
  const handleCopy = () => {
    if (generatedText) {
      navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const Step: React.FC<{ step: { id: number, name: string, description: string }, currentStep: number }> = ({ step, currentStep }) => {
    const status = currentStep === step.id ? 'current' : currentStep > step.id ? 'complete' : 'upcoming';
    return (
        <li className="relative md:flex-1 md:flex">
            {step.id < steps.length && (
                <div className="hidden md:block absolute top-0 left-full w-full h-px bg-slate-700" aria-hidden="true" />
            )}
            <div className="group flex items-center w-full">
                <span className="px-6 py-4 flex items-center text-sm font-medium">
                    <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full 
                        ${status === 'complete' ? 'bg-indigo-600' : ''}
                        ${status === 'current' ? 'border-2 border-indigo-600' : ''}
                        ${status === 'upcoming' ? 'border-2 border-slate-600' : ''}`}>
                        {status === 'complete' ? (
                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>
                        ) : (
                            <span className={`${status === 'current' ? 'text-indigo-500' : 'text-slate-400'}`}>{step.id}</span>
                        )}
                    </span>
                    <span className="ml-4 text-sm font-medium">
                        <span className={`block ${status === 'current' ? 'text-indigo-400' : 'text-slate-200'}`}>{step.name}</span>
                        <span className="block text-slate-500">{step.description}</span>
                    </span>
                </span>
            </div>
            {step.id < steps.length && (
                <div className="hidden md:block absolute top-0 right-0 h-full w-5" aria-hidden="true">
                    <svg className="h-full w-full text-slate-700" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                        <path d="M0.5 0V30L10.5 40L0.5 50V80" stroke="currentColor" vectorEffect="non-scaling-stroke"/>
                    </svg>
                </div>
            )}
        </li>
    );
};

// Fix: Changed component definition to use React.FC for better prop typing.
const Card: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
        </div>
        <div className="p-6 space-y-6">
            {children}
        </div>
    </div>
  );


  return (
    <>
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        
        {/* Stepper */}
        <nav aria-label="Progress">
            <ol role="list" className="border border-slate-700 rounded-lg divide-y divide-slate-700 md:flex md:divide-y-0 mb-8">
                {steps.map((step) => <Step key={step.id} step={step} currentStep={currentStep} />)}
            </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-8">
            {error && currentStep === 4 && (
              <div className="p-4 mb-4 text-sm text-red-300 bg-red-900/50 rounded-lg border border-red-500" role="alert">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}
              {currentStep === 1 && (
                <Card title="Langkah 1: Informasi Dokumen & Pengadilan">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SelectField id="jenisDokumen" name="jenisDokumen" label="Jenis Dokumen" value={formData.jenisDokumen} onChange={handleChange}>
                          <option value="Penetapan">Penetapan</option>
                          <option value="Berita Acara">Berita Acara</option>
                          <option value="Surat">Surat</option>
                      </SelectField>
                      
                      {formData.jenisDokumen === 'Penetapan' && (
                          <SelectField id="jenisPenetapan" name="jenisPenetapan" label="Jenis Penetapan" value={formData.jenisPenetapan!} onChange={handleChange}>
                          <option value="Penetapan Aanmaning">Penetapan Aanmaning</option>
                          <option value="Penetapan Sita Eksekusi">Penetapan Sita Eksekusi</option>
                          <option value="Penetapan Pemblokiran Rekening">Penetapan Pemblokiran Rekening</option>
                          <option value="Penetapan Eksekusi Pengosongan dan Penyerahan">Penetapan Eksekusi Pengosongan dan Penyerahan</option>
                          <option value="Penetapan Lelang">Penetapan Lelang</option>
                          </SelectField>
                      )}

                      {formData.jenisDokumen === 'Berita Acara' && (
                          <SelectField id="jenisBeritaAcara" name="jenisBeritaAcara" label="Jenis Berita Acara" value={formData.jenisBeritaAcara!} onChange={handleChange}>
                              <option value="Berita Acara Aanmaning">Berita Acara Aanmaning</option>
                              <option value="Berita Acara Sita Eksekusi">Berita Acara Sita Eksekusi</option>
                              <option value="Berita Acara Pemblokiran Rekening">Berita Acara Pemblokiran Rekening</option>
                              <option value="Berita Acara Eksekusi Pengosongan dan Penyerahan">Berita Acara Eksekusi Pengosongan dan Penyerahan</option>
                              <option value="Berita Acara Lelang">Berita Acara Lelang</option>
                          </SelectField>
                      )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-700/50">
                      <SelectField id="courtName" name="courtName" label="Nama Pengadilan" value={formData.courtName} onChange={handleChange} required>
                          {courts.map(court => <option key={court} value={court}>{court}</option>)}
                      </SelectField>
                      <InputField id="determinationDate" name="determinationDate" label={formData.jenisDokumen === 'Berita Acara' ? 'Tanggal Berita Acara' : 'Tanggal Penetapan'} type="date" value={formData.determinationDate} onChange={handleChange} required />
                      <InputField id="judgeName" name="judgeName" label="Nama Hakim/Ketua" value={formData.judgeName} onChange={handleChange} placeholder="cth: Wahyu Iman Santoso, S.H., M.H." required />
                      <InputField id="clerkName" name="clerkName" label="Nama Panitera" value={formData.clerkName} onChange={handleChange} placeholder="cth: Edi Sarwono, S.H., M.H." />
                  </div>
                </Card>
              )}

              {currentStep === 2 && (
                <Card title="Langkah 2: Informasi Perkara">
                    <div className="bg-slate-800 p-4 rounded-lg mb-6 border border-slate-700">
                        <h3 className="text-md font-semibold text-slate-200 mb-2">Otomatisasi dengan AI</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Unggah file PDF Putusan atau Penetapan Aanmaning untuk mengisi kolom di bawah ini secara otomatis.
                        </p>
                        <label htmlFor="pdf-upload" className="relative cursor-pointer bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-md p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 transition">
                             <div className="flex items-center space-x-3">
                                <svg className="h-8 w-8 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                <div className="text-sm text-slate-400">
                                    <span>{isParsingPdf ? 'Memproses PDF...' : 'Klik untuk mengunggah file'}</span>
                                    <p className="text-xs text-slate-500">PDF hingga 10MB</p>
                                </div>
                            </div>
                            <input id="pdf-upload" name="pdf-upload" type="file" className="sr-only" onChange={handleFileUpload} accept=".pdf" disabled={isParsingPdf} />
                            {isParsingPdf && (
                                <div className="absolute inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center rounded-md">
                                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                            )}
                        </label>
                        {error && !isParsingPdf && (
                            <p className="mt-2 text-sm text-red-400">{error}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectField id="jenisPerkara" name="jenisPerkara" label="Jenis Perkara" value={formData.jenisPerkara} onChange={handleChange}>
                            <option value="Putusan Perdata Umum (Pdt.Eks)">Putusan Perdata Umum (Pdt.Eks)</option>
                            <option value="Putusan Ekonomi Syariah (Eks.Syariah)">Putusan Ekonomi Syariah (Eks.Syariah)</option>
                            <option value="Putusan Hubungan Industrial (PHI)">Putusan Hubungan Industrial (PHI)</option>
                            <option value="Putusan Niaga (Niaga)">Putusan Niaga (Niaga)</option>
                        </SelectField>
                        <InputField id="nomorPerkara" name="nomorPerkara" label="Nomor Perkara Eksekusi" value={formData.nomorPerkara} onChange={handleChange} placeholder="cth: 1/Pdt.Eks/2024/PN Bdg" required />
                        <InputField id="pemohonEksekusi" name="pemohonEksekusi" label="Pemohon Eksekusi" value={formData.pemohonEksekusi} onChange={handleChange} required />
                        <InputField id="termohonEksekusi" name="termohonEksekusi" label="Termohon Eksekusi" value={formData.termohonEksekusi} onChange={handleChange} required />
                        <TextAreaField id="alamatPemohonEksekusi" name="alamatPemohonEksekusi" label="Alamat Pemohon Eksekusi" value={formData.alamatPemohonEksekusi} onChange={handleChange} rows={2}/>
                        <TextAreaField id="alamatTermohonEksekusi" name="alamatTermohonEksekusi" label="Alamat Termohon Eksekusi" value={formData.alamatTermohonEksekusi} onChange={handleChange} rows={2}/>
                    </div>
                    <div className="pt-6 border-t border-slate-700/50">
                        <h4 className="text-md font-medium text-slate-300 mb-4">Detail Permohonan</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField id="nomorSurat" name="nomorSurat" label="Nomor Surat Permohonan" value={formData.nomorSurat} onChange={handleChange} />
                            <InputField id="tanggalSurat" name="tanggalSurat" label="Tanggal Surat Permohonan" type="date" value={formData.tanggalSurat} onChange={handleChange} required/>
                            <InputField id="namaKuasa" name="namaKuasa" label="Nama Kuasa (jika ada)" value={formData.namaKuasa!} onChange={handleChange} />
                            <InputField id="alamatKuasa" name="alamatKuasa" label="Alamat Kuasa" value={formData.alamatKuasa!} onChange={handleChange} />
                            <InputField id="tanggalSuratKuasa" name="tanggalSuratKuasa" label="Tanggal Surat Kuasa" type="date" value={formData.tanggalSuratKuasa!} onChange={handleChange} />
                        </div>
                    </div>
                </Card>
              )}

              {currentStep === 3 && (
                 <Card title="Langkah 3: Detail Putusan">
                    <p className="text-sm text-slate-400 -mt-2 mb-4">Isi detail putusan dari setiap tingkatan yang relevan. Kolom amar putusan penting untuk AI dalam membuat pertimbangan hukum.</p>
                    <div className="space-y-6">
                        {/* Putusan Tk. I */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-700/50 rounded-md">
                            <h4 className="md:col-span-2 text-md font-medium text-slate-300 -mb-2">Putusan Tingkat Pertama</h4>
                            <InputField id="nomorPutusanPertama" name="nomorPutusanPertama" label="Nomor Putusan" value={formData.nomorPutusanPertama} onChange={handleChange} placeholder="cth: 1/Pdt.G/2023/PN Bdg"/>
                            <InputField id="tanggalPutusanPertama" name="tanggalPutusanPertama" label="Tanggal Putusan" type="date" value={formData.tanggalPutusanPertama} onChange={handleChange} />
                            <TextAreaField id="amarPutusanPertama" name="amarPutusanPertama" label="Amar Putusan" value={formData.amarPutusanPertama} onChange={handleChange} rows={3} placeholder="Salin amar putusan di sini..."/>
                        </div>
                        {/* Putusan Banding */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-700/50 rounded-md">
                            <h4 className="md:col-span-2 text-md font-medium text-slate-300 -mb-2">Putusan Banding</h4>
                             <InputField id="nomorPutusanBanding" name="nomorPutusanBanding" label="Nomor Putusan" value={formData.nomorPutusanBanding} onChange={handleChange} />
                            <InputField id="tanggalPutusanBanding" name="tanggalPutusanBanding" label="Tanggal Putusan" type="date" value={formData.tanggalPutusanBanding} onChange={handleChange} />
                            <TextAreaField id="amarPutusanBanding" name="amarPutusanBanding" label="Amar Putusan" value={formData.amarPutusanBanding} onChange={handleChange} rows={3}/>
                        </div>
                        {/* Putusan Kasasi */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-700/50 rounded-md">
                            <h4 className="md:col-span-2 text-md font-medium text-slate-300 -mb-2">Putusan Kasasi</h4>
                            <InputField id="nomorPutusanKasasi" name="nomorPutusanKasasi" label="Nomor Putusan" value={formData.nomorPutusanKasasi} onChange={handleChange} />
                            <InputField id="tanggalPutusanKasasi" name="tanggalPutusanKasasi" label="Tanggal Putusan" type="date" value={formData.tanggalPutusanKasasi} onChange={handleChange} />
                            <TextAreaField id="amarPutusanKasasi" name="amarPutusanKasasi" label="Amar Putusan" value={formData.amarPutusanKasasi} onChange={handleChange} rows={3}/>
                        </div>
                        {/* Putusan PK */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-700/50 rounded-md">
                            <h4 className="md:col-span-2 text-md font-medium text-slate-300 -mb-2">Putusan Peninjauan Kembali (PK)</h4>
                            <InputField id="nomorPutusanPK" name="nomorPutusanPK" label="Nomor Putusan" value={formData.nomorPutusanPK} onChange={handleChange} />
                            <InputField id="tanggalPutusanPK" name="tanggalPutusanPK" label="Tanggal Putusan" type="date" value={formData.tanggalPutusanPK} onChange={handleChange} />
                            <TextAreaField id="amarPutusanPK" name="amarPutusanPK" label="Amar Putusan" value={formData.amarPutusanPK} onChange={handleChange} rows={3}/>
                        </div>
                    </div>
                 </Card>
              )}

              {currentStep === 4 && (
                <Card title="Langkah 4: Substansi Dokumen & Finalisasi">
                    {formData.jenisDokumen !== 'Berita Acara' ? (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-400 -mt-2">
                                Bagian ini untuk kustomisasi tingkat lanjut. Untuk <code className="bg-slate-700 text-slate-200 px-1 rounded text-xs">Penetapan Aanmaning</code>, AI akan mengisi otomatis bagian MENIMBANG dan MENGINGAT.
                            </p>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-400">Bagian "Membaca"</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                                    <CheckboxField id="membacaSurat" name="suratPermohonan" label="Surat Permohonan" checked={formData.membaca.suratPermohonan} onChange={handleChange} />
                                    <CheckboxField id="membacaPutusan1" name="putusanPertama" label="Putusan Tk. I" checked={formData.membaca.putusanPertama} onChange={handleChange} />
                                    <CheckboxField id="membacaPutusan2" name="putusanBanding" label="Putusan Banding" checked={formData.membaca.putusanBanding} onChange={handleChange} />
                                    <CheckboxField id="membacaPutusan3" name="putusanKasasi" label="Putusan Kasasi" checked={formData.membaca.putusanKasasi} onChange={handleChange} />
                                    <CheckboxField id="membacaPutusan4" name="putusanPK" label="Putusan PK" checked={formData.membaca.putusanPK} onChange={handleChange} />
                                    <CheckboxField id="membacaBerkas" name="berkasPerkara" label="Berkas Perkara" checked={formData.membaca.berkasPerkara} onChange={handleChange} />
                                </div>
                            </div>
                            <TextAreaField id="menimbang" name="menimbang" label="Menimbang (Opsional)" value={formData.menimbang} onChange={handleChange} rows={5} placeholder="Kosongkan agar diisi AI..."/>
                            <TextAreaField id="mengingat" name="mengingat" label="Mengingat (Opsional)" value={formData.mengingat} onChange={handleChange} rows={3} placeholder="Kosongkan agar diisi AI..."/>
                            <TextAreaField id="menetapkan" name="menetapkan" label="Menetapkan (Opsional)" value={formData.menetapkan} onChange={handleChange} rows={5} placeholder="Kosongkan agar diisi AI..."/>
                            {formData.jenisDokumen === 'Surat' && (
                            <TextAreaField id="tembusan" name="tembusan" label="Tembusan" value={formData.tembusan} onChange={handleChange} rows={2} placeholder="Satu tembusan per baris..."/>
                            )}
                        </div>
                    ) : (
                         <div className="space-y-6">
                            {formData.jenisBeritaAcara === 'Berita Acara Aanmaning' ? (
                                <>
                                    <div className="md:col-span-2">
                                    <CheckboxField id="aanmaningSelesai" name="aanmaningSelesai" label="Aanmaning Selesai" checked={!!formData.aanmaningSelesai} onChange={handleChange} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InputField id="tanggalSidangBerikutnya" name="tanggalSidangBerikutnya" label="Tanggal Sidang Berikutnya" type="date" value={formData.tanggalSidangBerikutnya!} onChange={handleChange} required disabled={!!formData.aanmaningSelesai} />
                                        <InputField id="waktuSidangBerikutnya" name="waktuSidangBerikutnya" label="Waktu Sidang Berikutnya" type="time" value={formData.waktuSidangBerikutnya!} onChange={handleChange} required disabled={!!formData.aanmaningSelesai} />
                                    </div>
                                    <TextAreaField id="isiBeritaAcara" name="isiBeritaAcara" label="Isi/Jalannya Berita Acara (Opsional)" value={formData.isiBeritaAcara!} onChange={handleChange} rows={6} placeholder="Kosongkan untuk menggunakan narasi default sesuai template."/>
                                </>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField id="namaJurusita" name="namaJurusita" label="Nama Jurusita/Pejabat" value={formData.namaJurusita!} onChange={handleChange} placeholder="cth: Rahmat Hidayat, S.H."/>
                                    <div className="md:col-span-2"></div>
                                    <TextAreaField id="pihakHadir" name="pihakHadir" label="Pihak yang Hadir" value={formData.pihakHadir!} onChange={handleChange} rows={3} placeholder="Satu pihak per baris..."/>
                                    <TextAreaField id="isiBeritaAcara" name="isiBeritaAcara" label="Isi/Jalannya Berita Acara" value={formData.isiBeritaAcara!} onChange={handleChange} rows={6} placeholder="Jelaskan kronologi kejadian..."/>
                                    <InputField id="namaSaksi1" name="namaSaksi1" label="Nama Saksi 1 (jika ada)" value={formData.namaSaksi1!} onChange={handleChange} />
                                    <InputField id="namaSaksi2" name="namaSaksi2" label="Nama Saksi 2 (jika ada)" value={formData.namaSaksi2!} onChange={handleChange} />
                                </div>
                            )}
                         </div>
                    )}
                    <div className="pt-6 border-t border-slate-700/50">
                        <CheckboxField id="isProdeo" name="isProdeo" label="Permohonan Prodeo/Bebas Biaya" checked={formData.isProdeo} onChange={handleChange} />
                    </div>

                    <div className="flex items-center justify-center pt-4">
                        <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex justify-center items-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                        >
                        {isLoading ? (
                            <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Memproses...
                            </>
                        ) : 'Buat Draf Dokumen'}
                        </button>
                    </div>
                </Card>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <button type="button" onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 1} className="inline-flex items-center gap-2 py-2 px-4 border border-slate-600 shadow-sm text-sm font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    Kembali
                </button>
                <button type="button" onClick={() => setCurrentStep(s => s + 1)} disabled={currentStep === steps.length} className="inline-flex items-center gap-2 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    Lanjut
                </button>
              </div>

            </form>
          </div>

          {/* Result Section */}
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 p-6 rounded-lg shadow-lg h-full flex flex-col sticky top-28" style={{maxHeight: 'calc(100vh - 8rem)'}}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-100">Hasil Draf</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handleCopy} disabled={!generatedText} className="relative inline-flex items-center gap-2 p-2 text-sm font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition">
                        {copied ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                    </button>
                    <button onClick={handleExport} disabled={!generatedText || isLoading} className="inline-flex items-center gap-2 py-2 px-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 6a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM3 15a1 1 0 100 2h14a1 1 0 100-2H3z" /></svg>
                        Export .docx
                    </button>
                </div>
            </div>
           
            <div ref={resultRef} className="flex-grow bg-slate-900 rounded-md p-4 overflow-auto border border-slate-700/50">
              {generatedText ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-300 font-serif leading-relaxed">{generatedText}</pre>
              ) : (
                <div className="flex items-center justify-center h-full">
                   {isLoading ? (
                     <div className="text-center text-slate-400">
                        <svg className="animate-spin mx-auto h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="mt-3">AI sedang membuat draf dokumen...</p>
                     </div>
                   ) : (
                    <div className="text-center text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="mt-2">Draf dokumen akan muncul di sini.</p>
                    </div>
                   )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;