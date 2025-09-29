// types.ts

export interface MembacaOptions {
  suratPermohonan: boolean;
  putusanPertama: boolean;
  putusanBanding: boolean;
  putusanKasasi: boolean;
  putusanPK: boolean;
  berkasPerkara: boolean;
}

export interface PenetapanData {
  // Informasi Dokumen
  jenisDokumen: 'Surat' | 'Penetapan' | 'Berita Acara';
  jenisPenetapan?: 'Penetapan Aanmaning' | 'Penetapan Sita Eksekusi' | 'Penetapan Pemblokiran Rekening' | 'Penetapan Eksekusi Pengosongan dan Penyerahan' | 'Penetapan Lelang' | '';
  jenisBeritaAcara?: 'Berita Acara Aanmaning' | 'Berita Acara Sita Eksekusi' | 'Berita Acara Pemblokiran Rekening' | 'Berita Acara Eksekusi Pengosongan dan Penyerahan' | 'Berita Acara Lelang' | '';
  
  // Informasi Pengadilan
  courtName: string;
  determinationDate: string;
  judgeName: string;
  clerkName: string;

  // Informasi Perkara
  jenisPerkara: string;
  nomorPerkara: string;
  pemohonEksekusi: string;
  alamatPemohonEksekusi: string;
  termohonEksekusi: string;
  alamatTermohonEksekusi: string;
  nomorPutusanPertama: string;
  tanggalPutusanPertama: string;
  amarPutusanPertama: string;
  nomorPutusanBanding: string;
  tanggalPutusanBanding: string;
  amarPutusanBanding: string;
  nomorPutusanKasasi: string;
  tanggalPutusanKasasi: string;
  amarPutusanKasasi: string;
  nomorPutusanPK: string;
  tanggalPutusanPK: string;
  amarPutusanPK: string;
  
  // Detail Permohonan
  nomorSurat: string;
  tanggalSurat: string;
  namaKuasa?: string;
  alamatKuasa?: string;
  tanggalSuratKuasa?: string;

  // Substansi Dokumen (Untuk Penetapan/Surat)
  membaca: MembacaOptions;
  menimbang: string;
  mengingat: string;
  menetapkan: string;
  tembusan: string;
  
  // Detail Berita Acara
  namaJurusita?: string;
  pihakHadir?: string;
  isiBeritaAcara?: string;
  namaSaksi1?: string;
  namaSaksi2?: string;
  tanggalSidangBerikutnya?: string;
  waktuSidangBerikutnya?: string;

  // Lain-lain
  isProdeo: boolean;
}