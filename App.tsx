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
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.5.136/build/pdf.worker.mjs';

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
    namaJurusita: 'Rahmat Hidayat, S.H.',
    pihakHadir: '',
    isiBeritaAcara: '',
    namaSaksi1: '',
    namaSaksi2: '',
    tanggalSidangBerikutnya: '',
    waktuSidangBerikutnya: '10:00',
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

  return (
    <>
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Input Data Penetapan</h2>

            {/* PDF Upload */}
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-8 border border-slate-700">
                <h3 className="text-xl font-semibold text-slate-200 mb-4">Otomatisasi dengan AI</h3>
                <p className="text-sm text-slate-400 mb-4">
                    Unggah file PDF Putusan atau Penetapan Aanmaning sebelumnya untuk mengisi kolom informasi perkara secara otomatis.
                </p>
                <label htmlFor="pdf-upload" className="relative cursor-pointer bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-md p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 transition">
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-slate-400">
                            <span>{isParsingPdf ? 'Memproses PDF...' : 'Unggah file'}</span>
                            <input id="pdf-upload" name="pdf-upload" type="file" className="sr-only" onChange={handleFileUpload} accept=".pdf" disabled={isParsingPdf} />
                        </div>
                        <p className="text-xs text-slate-500">PDF hingga 10MB</p>
                    </div>
                    {isParsingPdf && (
                         <div className="absolute inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </label>
            </div>


            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Document Info */}
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Informasi Dokumen</h3>
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
              </div>

              {/* Court Info */}
              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Informasi Pengadilan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField id="courtName" name="courtName" label="Nama Pengadilan" value={formData.courtName} onChange={handleChange} required>
                    {courts.map(court => <option key={court} value={court}>{court}</option>)}
                  </SelectField>
                  <InputField id="determinationDate" name="determinationDate" label={formData.jenisDokumen === 'Berita Acara' ? 'Tanggal Berita Acara' : 'Tanggal Penetapan'} type="date" value={formData.determinationDate} onChange={handleChange} required />
                  <InputField id="judgeName" name="judgeName" label="Nama Hakim/Ketua" value={formData.judgeName} onChange={handleChange} placeholder="cth: Wahyu Iman Santoso, S.H., M.H." required />
                  <InputField id="clerkName" name="clerkName" label="Nama Panitera" value={formData.clerkName} onChange={handleChange} placeholder="cth: Edi Sarwono, S.H., M.H." />
                </div>
              </div>

              {/* Case Info */}
              <div className="border-t border-slate-700 pt-6">
                 <h3 className="text-lg font-semibold text-slate-200 mb-4">Informasi Perkara</h3>
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
                    
                    {/* Putusan Fields */}
                    <InputField id="nomorPutusanPertama" name="nomorPutusanPertama" label="Nomor Putusan Tk. I" value={formData.nomorPutusanPertama} onChange={handleChange} placeholder="cth: 1/Pdt.G/2023/PN Bdg"/>
                    <InputField id="tanggalPutusanPertama" name="tanggalPutusanPertama" label="Tgl. Putusan Tk. I" type="date" value={formData.tanggalPutusanPertama} onChange={handleChange} />
                    <TextAreaField id="amarPutusanPertama" name="amarPutusanPertama" label="Amar Putusan Tk. I" value={formData.amarPutusanPertama} onChange={handleChange} rows={3}/>
                    <div></div> {/* Spacer */}
                    
                    <InputField id="nomorPutusanBanding" name="nomorPutusanBanding" label="Nomor Putusan Banding" value={formData.nomorPutusanBanding} onChange={handleChange} />
                    <InputField id="tanggalPutusanBanding" name="tanggalPutusanBanding" label="Tgl. Putusan Banding" type="date" value={formData.tanggalPutusanBanding} onChange={handleChange} />
                    <TextAreaField id="amarPutusanBanding" name="amarPutusanBanding" label="Amar Putusan Banding" value={formData.amarPutusanBanding} onChange={handleChange} rows={3}/>
                     <div></div> {/* Spacer */}

                    <InputField id="nomorPutusanKasasi" name="nomorPutusanKasasi" label="Nomor Putusan Kasasi" value={formData.nomorPutusanKasasi} onChange={handleChange} />
                    <InputField id="tanggalPutusanKasasi" name="tanggalPutusanKasasi" label="Tgl. Putusan Kasasi" type="date" value={formData.tanggalPutusanKasasi} onChange={handleChange} />
                    <TextAreaField id="amarPutusanKasasi" name="amarPutusanKasasi" label="Amar Putusan Kasasi" value={formData.amarPutusanKasasi} onChange={handleChange} rows={3}/>
                     <div></div> {/* Spacer */}

                    <InputField id="nomorPutusanPK" name="nomorPutusanPK" label="Nomor Putusan PK" value={formData.nomorPutusanPK} onChange={handleChange} />
                    <InputField id="tanggalPutusanPK" name="tanggalPutusanPK" label="Tgl. Putusan PK" type="date" value={formData.tanggalPutusanPK} onChange={handleChange} />
                    <TextAreaField id="amarPutusanPK" name="amarPutusanPK" label="Amar Putusan PK" value={formData.amarPutusanPK} onChange={handleChange} rows={3}/>
                 </div>
              </div>
              
               {/* Application Details */}
              <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Detail Permohonan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField id="nomorSurat" name="nomorSurat" label="Nomor Surat Permohonan" value={formData.nomorSurat} onChange={handleChange} />
                      <InputField id="tanggalSurat" name="tanggalSurat" label="Tanggal Surat Permohonan" type="date" value={formData.tanggalSurat} onChange={handleChange} required/>
                      <InputField id="namaKuasa" name="namaKuasa" label="Nama Kuasa (jika ada)" value={formData.namaKuasa!} onChange={handleChange} />
                      <InputField id="alamatKuasa" name="alamatKuasa" label="Alamat Kuasa" value={formData.alamatKuasa!} onChange={handleChange} />
                      <InputField id="tanggalSuratKuasa" name="tanggalSuratKuasa" label="Tanggal Surat Kuasa" type="date" value={formData.tanggalSuratKuasa!} onChange={handleChange} />
                  </div>
              </div>

              {formData.jenisDokumen !== 'Berita Acara' && (
                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Substansi Dokumen (Opsional)</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Bagian ini untuk kustomisasi tingkat lanjut. Untuk <code className="bg-slate-700 px-1 rounded">Penetapan Aanmaning</code>, AI akan mengisi otomatis bagian MENIMBANG dan MENGINGAT.
                  </p>
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-300">Bagian "Membaca"</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              <CheckboxField id="membacaSurat" name="suratPermohonan" label="Surat Permohonan" checked={formData.membaca.suratPermohonan} onChange={handleChange} />
                              <CheckboxField id="membacaPutusan1" name="putusanPertama" label="Putusan Tk. I" checked={formData.membaca.putusanPertama} onChange={handleChange} />
                              <CheckboxField id="membacaPutusan2" name="putusanBanding" label="Putusan Banding" checked={formData.membaca.putusanBanding} onChange={handleChange} />
                              <CheckboxField id="membacaPutusan3" name="putusanKasasi" label="Putusan Kasasi" checked={formData.membaca.putusanKasasi} onChange={handleChange} />
                              <CheckboxField id="membacaPutusan4" name="putusanPK" label="Putusan PK" checked={formData.membaca.putusanPK} onChange={handleChange} />
                              <CheckboxField id="membacaBerkas" name="berkasPerkara" label="Berkas Perkara" checked={formData.membaca.berkasPerkara} onChange={handleChange} />
                          </div>
                      </div>
                    <TextAreaField id="menimbang" name="menimbang" label="Menimbang" value={formData.menimbang} onChange={handleChange} rows={5} placeholder="Pertimbangan hukum..."/>
                    <TextAreaField id="mengingat" name="mengingat" label="Mengingat" value={formData.mengingat} onChange={handleChange} rows={3} placeholder="Pasal-pasal yang relevan..."/>
                    <TextAreaField id="menetapkan" name="menetapkan" label="Menetapkan" value={formData.menetapkan} onChange={handleChange} rows={5} placeholder="Amar penetapan..."/>
                    {formData.jenisDokumen === 'Surat' && (
                      <TextAreaField id="tembusan" name="tembusan" label="Tembusan" value={formData.tembusan} onChange={handleChange} rows={2} placeholder="Satu tembusan per baris..."/>
                    )}
                  </div>
                </div>
              )}

              {formData.jenisDokumen === 'Berita Acara' && (
                <div className="border-t border-slate-700 pt-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Detail Berita Acara</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.jenisBeritaAcara === 'Berita Acara Aanmaning' ? (
                            <>
                                <InputField id="tanggalSidangBerikutnya" name="tanggalSidangBerikutnya" label="Tanggal Sidang Berikutnya" type="date" value={formData.tanggalSidangBerikutnya!} onChange={handleChange} required />
                                <InputField id="waktuSidangBerikutnya" name="waktuSidangBerikutnya" label="Waktu Sidang Berikutnya" type="time" value={formData.waktuSidangBerikutnya!} onChange={handleChange} required />
                                <div className="md:col-span-2">
                                  <TextAreaField id="isiBeritaAcara" name="isiBeritaAcara" label="Isi/Jalannya Berita Acara (Opsional)" value={formData.isiBeritaAcara!} onChange={handleChange} rows={6} placeholder="Kosongkan untuk menggunakan narasi default sesuai template."/>
                                </div>
                            </>
                        ) : (
                            <>
                                <InputField id="namaJurusita" name="namaJurusita" label="Nama Jurusita/Pejabat" value={formData.namaJurusita!} onChange={handleChange} placeholder="cth: Rahmat Hidayat, S.H."/>
                                <div className="md:col-span-2"></div>
                                <TextAreaField id="pihakHadir" name="pihakHadir" label="Pihak yang Hadir" value={formData.pihakHadir!} onChange={handleChange} rows={3} placeholder="Satu pihak per baris..."/>
                                <TextAreaField id="isiBeritaAcara" name="isiBeritaAcara" label="Isi/Jalannya Berita Acara" value={formData.isiBeritaAcara!} onChange={handleChange} rows={6} placeholder="Jelaskan kronologi kejadian..."/>
                                <InputField id="namaSaksi1" name="namaSaksi1" label="Nama Saksi 1 (jika ada)" value={formData.namaSaksi1!} onChange={handleChange} />
                                <InputField id="namaSaksi2" name="namaSaksi2" label="Nama Saksi 2 (jika ada)" value={formData.namaSaksi2!} onChange={handleChange} />
                            </>
                        )}
                    </div>
                </div>
              )}
              
              <div className="border-t border-slate-700 pt-6">
                <CheckboxField id="isProdeo" name="isProdeo" label="Permohonan Prodeo/Bebas Biaya" checked={formData.isProdeo} onChange={handleChange} />
              </div>

              <div className="flex items-center justify-end pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Memproses...
                    </>
                  ) : 'Buat Draf Dokumen'}
                </button>
              </div>
            </form>
          </div>

          {/* Result Section */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-100">Hasil Draf</h2>
                <button
                    onClick={handleExport}
                    disabled={!generatedText || isLoading}
                    className="inline-flex items-center gap-2 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Export ke .docx
                </button>
            </div>
            {error && (
              <div className="p-4 mb-4 text-sm text-red-300 bg-red-900/50 rounded-lg border border-red-500" role="alert">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}
            <div className="flex-grow bg-slate-900 rounded-md p-4 overflow-auto">
              {generatedText ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans">{generatedText}</pre>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2">Draf dokumen akan muncul di sini setelah dibuat.</p>
                  </div>
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