import { GoogleGenAI } from "@google/genai";
import { PenetapanData } from "../types";
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  UnderlineType, 
  Footer, 
  PageNumber,
  TabStopType,
  Tab,
  Numbering,
  Header
} from 'docx';
import saveAs from 'file-saver';


const formatDate = (dateString: string) => {
    if (!dateString) return '';
    // 'id-ID' locale naturally formats as dd/mm/yyyy
    return new Date(dateString).toLocaleDateString('id-ID');
};

export const exportToDocx = (text: string, fileName: string) => {
  const lines = text.split('\n');
  const courtName = lines.length > 0 ? lines[0].trim() : 'PENGADILAN';
  const paragraphs: Paragraph[] = [];

  const numbering = {
      config: [
          {
              levels: [
                  {
                      level: 0,
                      format: "decimal",
                      text: "%1.",
                      alignment: AlignmentType.START,
                      style: {
                          paragraph: {
                              indent: { left: 720, hanging: 360 }, // 0.5 inch indent, 0.25 inch hanging
                          },
                      },
                  },
              ],
              reference: "my-numbering-style",
          },
      ],
  };

  let inMenimbangSection = false;
  let inMenetapkanSection = false;
  let inMembacaSection = false;
  
  // Heuristic to identify judge name based on common format
  const isJudgeName = (line: string) => /^[A-Z\s.,'SHMHCNED]+$/i.test(line) && line.includes('S.H.');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip the first line as it will be in the header
    if (i === 0 && trimmedLine.startsWith('PENGADILAN NEGERI')) {
        continue;
    }

    if (trimmedLine === '') {
      paragraphs.push(new Paragraph({ style: "default"}));
      continue;
    }

    let p: Paragraph;
    const partyMatch = trimmedLine.match(/^(.*),\s*sebagai\s*(Pemohon Eksekusi|Termohon Eksekusi);$/);
    
    // Cost section with tabs
    if (line.includes('[TAB]')) {
      const parts = line.split('[TAB]');
      p = new Paragraph({
        style: "default",
        tabStops: [
            { type: TabStopType.LEFT, position: 2800 },
            { type: TabStopType.RIGHT, position: 5500 },
        ],
        children: [
            new TextRun(parts[0] || ''),
            new TextRun({ children: [new Tab(), parts[1] || ''] }),
            new TextRun({ children: [new Tab(), parts[2] || ''] }),
        ],
      });
    }
    // Party lines with special bold formatting
    else if (partyMatch) {
        const name = partyMatch[1].trim();
        const role = partyMatch[2];
        p = new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: name, bold: true }),
                new TextRun({ text: ', sebagai ' }),
                new TextRun({ text: role, bold: true }),
                new TextRun({ text: ';' }),
            ],
        });
    }
    else if (['Lawan', 'MELAWAN'].includes(trimmedLine)) {
        p = new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: trimmedLine, bold: true })]
        });
    }
    // Regular text processing
    else {
      let alignment: AlignmentType = AlignmentType.LEFT;
      let bold = false;
      let allCaps = false;
      let underline: {type: UnderlineType} | undefined = undefined;
      let numberingProp;
      let text = line;
      
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const isPotentiallyJudgeName = isJudgeName(trimmedLine) && prevLine.startsWith('KETUA');

      // Section state management
      if (trimmedLine === 'SETELAH MEMBACA:') inMembacaSection = true;
      if (trimmedLine === 'MENIMBANG:') { inMembacaSection = false; inMenimbangSection = true; }
      if (trimmedLine === 'Memperhatikan:') inMenimbangSection = false;
      if (trimmedLine === 'MENETAPKAN:') { inMenimbangSection = false; inMenetapkanSection = true; }
      if (trimmedLine.startsWith('DEMIKIANLAH')) { inMenetapkanSection = false; inMembacaSection = false; inMenimbangSection = false; }


      // Formatting rules based on content and position
      if (trimmedLine.startsWith('PENGADILAN NEGERI') && i === 0) {
        alignment = AlignmentType.CENTER;
        allCaps = true;
      } else if (trimmedLine === 'PENETAPAN') {
        alignment = AlignmentType.CENTER;
        bold = true;
        allCaps = true;
      } else if (trimmedLine.startsWith('Nomor ') && i < 5) {
        alignment = AlignmentType.CENTER;
      } else if (trimmedLine === 'DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA') {
        alignment = AlignmentType.CENTER;
        allCaps = true;
      } else if (['SETELAH MEMBACA:', 'MENIMBANG:'].includes(trimmedLine)) {
        bold = true;
        allCaps = true;
      } else if (trimmedLine === 'MENETAPKAN:') {
        alignment = AlignmentType.CENTER;
        bold = true;
        allCaps = true;
      } else if (trimmedLine.startsWith('KETUA PENGADILAN')) {
        alignment = AlignmentType.CENTER;
        allCaps = true;
      } else if (isPotentiallyJudgeName) {
        alignment = AlignmentType.CENTER;
        bold = true;
        underline = { type: UnderlineType.SINGLE };
        text = trimmedLine;
      } else if (trimmedLine === 'Perincian Biaya:') {
        bold = true;
      } else if ((inMembacaSection || inMenetapkanSection) && (trimmedLine.match(/^\d+[\.)]/) || trimmedLine.match(/^-/))) {
        numberingProp = { reference: "my-numbering-style", level: 0 };
        text = text.replace(/^\s*(\d+[\.)]|-)\s*/, '');
      } else if (inMenimbangSection && trimmedLine !== '' && !['MENGADILI:', 'DALAM KONVENSI :', 'DALAM EKSEPSI :', 'DALAM POKOK PERKARA :'].includes(trimmedLine)) {
        alignment = AlignmentType.JUSTIFIED;
      } else if (['MENGADILI:', 'DALAM KONVENSI :', 'DALAM EKSEPSI :', 'DALAM POKOK PERKARA :'].includes(trimmedLine)) {
        alignment = AlignmentType.CENTER;
        allCaps = true;
      }
      
      p = new Paragraph({
        style: "default",
        alignment: alignment,
        numbering: numberingProp,
        children: [new TextRun({ text, bold, allCaps, underline })],
      });
    }
    paragraphs.push(p);
  }

  const pageNumberFooter = new Footer({
      children: [
          new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                  new TextRun({
                      children: [PageNumber.CURRENT],
                      font: "Arial",
                      size: 20, // 10pt
                  }),
              ],
          }),
      ],
  });

  const doc = new Document({
    numbering: numbering,
    styles: {
        paragraphStyles: [
            {
                id: "default",
                name: "Default Style",
                basedOn: "Normal",
                next: "Normal",
                run: {
                    font: "Arial",
                    size: 24, // 12pt
                },
                paragraph: {
                  spacing: { after: 120 }, // 6pt spacing
                }
            },
        ],
    },
    sections: [
      {
        properties: {
          titlePage: true, // Use different header on the first page
        },
        headers: {
            first: new Header({ // Header for the first page only
                children: [
                    new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [
                            new TextRun({
                                text: courtName.toUpperCase(),
                                font: "Arial",
                                size: 24, // 12pt
                                bold: true,
                                underline: { type: UnderlineType.SINGLE },
                            }),
                        ],
                    }),
                ],
            }),
            default: new Header({ children: [] }), // Empty header for subsequent pages
        },
        footers: {
            default: pageNumberFooter,
            first: pageNumberFooter,
        },
        children: paragraphs,
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, fileName);
  });
};

export const generatePenetapanText = async (data: PenetapanData): Promise<string> => {
  // =================================================================
  // TEMPLATE KHUSUS UNTUK PENETAPAN AANMANING
  // =================================================================
  if (data.jenisDokumen === 'Penetapan' && data.jenisPenetapan === 'Penetapan Aanmaning') {
    const fullCourtName = data.courtName.split('(')[0].trim();
    const courtCity = fullCourtName.replace(/Pengadilan Negeri/i, '').trim();

    const putusanNomors = [
      data.nomorPutusanPertama,
      data.nomorPutusanBanding,
      data.nomorPutusanKasasi,
      data.nomorPutusanPK,
    ].filter(Boolean);

    const allNomorJo = [data.nomorPerkara, ...putusanNomors].filter(Boolean);
    const fullNomorString = allNomorJo.map((nomor, index) => index === 0 ? `Nomor ${nomor}` : `jo. Nomor ${nomor}`).join(' ');
    
    const putusanJoString = allNomorJo.slice(1).length > 0
        ? `Nomor ${allNomorJo.slice(1).join(' jo. Nomor ')}`
        : `putusan ${fullCourtName} Nomor ${data.nomorPutusanPertama}`;


    const pemohonText = data.namaKuasa 
      ? `${data.namaKuasa}, selaku kuasa dari ${data.pemohonEksekusi}`
      : data.pemohonEksekusi;
    
    const detailSuratPermohonan = `Surat Permohonan dari ${pemohonText}, tanggal ${formatDate(data.tanggalSurat)}${data.nomorSurat ? `, Nomor ${data.nomorSurat}` : ''}`;
    
    const allPutusanNomors = [
      data.nomorPutusanPertama,
      data.nomorPutusanBanding,
      data.nomorPutusanKasasi,
      data.nomorPutusanPK,
    ].filter(Boolean);

    const perkaraJoString = allPutusanNomors.length > 0
      ? `Nomor ${allPutusanNomors.join(' jo. Nomor ')}`
      : '[Belum ada nomor putusan yang diisi]';

    const pemohonLine = `${data.pemohonEksekusi}, sebagai Pemohon Eksekusi;`;
    const termohonLine = `${data.termohonEksekusi}, sebagai Termohon Eksekusi;`;

    const membacaItems = [];
    membacaItems.push(
      `1. ${detailSuratPermohonan}, pada pokoknya mengajukan permohonan pelaksanaan isi putusan (eksekusi) perkara ${perkaraJoString}, dalam perkara antara:\n${pemohonLine}\nMELAWAN\n${termohonLine}`
    );

    if (data.nomorPutusanPertama) membacaItems.push(`2. Putusan ${fullCourtName} Nomor ${data.nomorPutusanPertama} tanggal ${formatDate(data.tanggalPutusanPertama)}.`);
    if (data.nomorPutusanBanding) membacaItems.push(`3. Putusan Pengadilan Tinggi Nomor ${data.nomorPutusanBanding} tanggal ${formatDate(data.tanggalPutusanBanding)}.`);
    if (data.nomorPutusanKasasi) membacaItems.push(`4. Putusan Mahkamah Agung RI Nomor ${data.nomorPutusanKasasi} tanggal ${formatDate(data.tanggalPutusanKasasi)}.`);
    if (data.nomorPutusanPK) membacaItems.push(`5. Putusan Mahkamah Agung RI Nomor ${data.nomorPutusanPK} tanggal ${formatDate(data.tanggalPutusanPK)}.`);
    if (data.nomorPerkara) membacaItems.push(`${membacaItems.length + 1}. Berkas Perkara ${fullNomorString}, dalam perkara antara: ${data.pemohonEksekusi} melawan ${data.termohonEksekusi}.`);
    
    const membacaSectionForPrompt = membacaItems.join('\n');

    let pihakDipanggil = [];
    if (data.namaKuasa) {
      pihakDipanggil.push(`1) ${data.namaKuasa}, beralamat di ${data.alamatKuasa || '[Alamat Kuasa]'}, selaku Kuasa dari ${data.pemohonEksekusi}, beralamat di ${data.alamatPemohonEksekusi}, berdasarkan Surat Kuasa tanggal ${formatDate(data.tanggalSuratKuasa) || '[Tanggal Surat Kuasa]'}, sebagai Pemohon Eksekusi;`);
    } else {
      pihakDipanggil.push(`1) ${data.pemohonEksekusi}, beralamat di ${data.alamatPemohonEksekusi}, sebagai Pemohon Eksekusi;`);
    }
    pihakDipanggil.push(`2) ${data.termohonEksekusi}, beralamat di ${data.alamatTermohonEksekusi}, sebagai Termohon Eksekusi;`);
    const pihakDipanggilString = pihakDipanggil.join('\n');

    const courtAddress = fullCourtName === "Pengadilan Negeri Bandung" 
      ? "di Jalan L.L.R.E. Martadinata No. 74-80 Bandung"
      : `di kantor ${fullCourtName}`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const prompt = `
      INSTRUKSI UTAMA:
      Anda adalah asisten ahli hukum yang bertugas membuat draf "Penetapan Aanmaning" untuk Pengadilan di Indonesia.
      Gunakan template dan data berikut untuk menghasilkan dokumen yang lengkap, formal, dan akurat.
      JANGAN mengubah struktur atau frasa baku dari template. Isi bagian yang memerlukan elaborasi (MENIMBANG dan Memperhatikan) secara cerdas dan profesional berdasarkan data yang diberikan.

      DATA SUMBER UNTUK ANALISIS:
      - Jenis Perkara: ${data.jenisPerkara}
      - Amar Putusan Tingkat Pertama: ${data.amarPutusanPertama || '[Tidak diisi]'}
      - Amar Putusan Banding: ${data.amarPutusanBanding || '[Tidak Ada]'}
      - Amar Putusan Kasasi: ${data.amarPutusanKasasi || '[Tidak Ada]'}
      - Amar Putusan PK: ${data.amarPutusanPK || '[Tidak Ada]'}

      --- TEMPLATE DOKUMEN YANG HARUS DIIKUTI ---
      PENGADILAN NEGERI ${courtCity.toUpperCase()}

      PENETAPAN
      ${fullNomorString}

      DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA

      Kami, Ketua ${fullCourtName};

      SETELAH MEMBACA:
      ${membacaSectionForPrompt}

      MENIMBANG:
      [INSTRUKSI UNTUK AI: Lakukan analisis hukum yang mendalam untuk menyusun pertimbangan hukum.
      1.  **Analisis Fakta:** Mulai dengan menyatakan bahwa Pemohon Eksekusi telah mengajukan permohonan eksekusi terhadap putusan yang telah berkekuatan hukum tetap (inkracht van gewijsde), mengingat Termohon Eksekusi tidak melaksanakannya secara sukarela. Ringkas amar putusan dari semua tingkatan (Pertama, Banding, Kasasi, PK) yang relevan.
      2.  **Analisis Hukum:** Lakukan analisis yuridis yang komprehensif dengan merujuk pada sumber-sumber hukum berikut:
          *   **Peraturan Perundang-undangan:** Identifikasi dan sebutkan pasal-pasal yang paling relevan, terutama dari Herzien Inlandsch Reglement (HIR) atau Reglement Buiten de Gewesten (RBG) yang mengatur tentang pelaksanaan putusan (misalnya Pasal 196 HIR). Sesuaikan dengan **Jenis Perkara** (${data.jenisPerkara}) jika ada undang-undang spesifik yang berlaku (misalnya UU Hak Tanggungan).
          *   **Peraturan & Surat Edaran Mahkamah Agung (PERMA & SEMA):** Jika ada, rujuk pada PERMA atau SEMA yang relevan dengan proses eksekusi atau aanmaning.
          *   **Asas dan Prinsip Hukum:** Jelaskan bagaimana permohonan ini sejalan dengan asas-asas hukum acara perdata, seperti asas bahwa putusan hakim harus dilaksanakan dan asas kepastian hukum.
          *   **Yurisprudensi dan Doktrin:** Jika memungkinkan, sebutkan yurisprudensi atau pendapat ahli (doktrin) yang memperkuat argumen bahwa aanmaning adalah langkah yang tepat dan perlu sebelum eksekusi paksa.
      3.  **Kesimpulan Pertimbangan:** Simpulkan bahwa berdasarkan analisis fakta dan hukum di atas, permohonan Pemohon Eksekusi telah memenuhi syarat formil dan materiil, beralasan menurut hukum, dan oleh karena itu patut untuk dikabulkan dengan terlebih dahulu memanggil Termohon Eksekusi untuk diberikan teguran (aanmaning).]

      Memperhatikan:
      [INSTRUKSI UNTUK AI: Sebutkan secara spesifik dasar hukum utama yang menjadi landasan penetapan ini, seperti Pasal 196 Herzien Inlandsch Reglement (H.I.R) dan peraturan perundang-undangan lain yang relevan hasil dari analisis di bagian MENIMBANG.]

      MENETAPKAN:
      - Mengabulkan permohonan Pemohon Eksekusi tersebut;
      - Memerintahkan Panitera ${fullCourtName} untuk menunjuk salah seorang Jurusita/Jurusita Pengganti pada Pengadilan Negeri tersebut yang dinilai cakap guna melaksanakan panggilan kepada:
      ${pihakDipanggilString}
      Supaya ia/mereka datang menghadap Ketua ${fullCourtName}, ${courtAddress}, pada:
      HARI: ________, TANGGAL: ______________________, JAM: ______ WIB
      - Bagi Pemohon Eksekusi sehubungan permohonannya tertanggal ${formatDate(data.tanggalSurat)}, yang diterima di Kepaniteraan ${fullCourtName} dengan Register Nomor ${data.nomorPerkara};
      - Bagi Termohon Eksekusi guna ditegur agar dalam tenggang waktu 8 (delapan) hari setelah ditegur untuk segera melaksanakan putusan ${putusanJoString};
      - Menyatakan bahwa mengenai biaya yang timbul sebagai akibat permohonan ini dibebankan kepada Pemohon Eksekusi;

      DEMIKIANLAH, ditetapkan di ${courtCity} pada tanggal ${formatDate(data.determinationDate)}.



      KETUA ${fullCourtName.toUpperCase()}





      ${data.judgeName || 'Wahyu Iman Santoso, S.H., M.H.'}


      Perincian Biaya:
      Redaksi[TAB]Rp.[TAB]10.000,-
      Materai[TAB]Rp.[TAB]10.000,-
      Pencatatan[TAB]Rp.[TAB]10.000,-
      Jumlah[TAB]Rp.[TAB]30.000,-
      --- END OF TEMPLATE ---

      HASILKAN DOKUMEN FINAL SECARA LENGKAP HANYA BERDASARKAN TEMPLATE DI ATAS. JANGAN TAMBAHKAN TEKS APAPUN DI LUAR TEMPLATE.
    `;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Error generating Aanmaning document:", error);
      throw new Error("Gagal menghasilkan dokumen Penetapan Aanmaning. Silakan coba lagi.");
    }
  }
  
  // =================================================================
  // LOGIKA GENERATOR DEFAULT UNTUK DOKUMEN LAIN
  // =================================================================

  let membacaItems: string[] = [];
  if (data.membaca.suratPermohonan) {
    const pemohonText = `${data.pemohonEksekusi}${data.namaKuasa ? ` melalui kuasanya ${data.namaKuasa}` : ''}`;
    const nomorSuratText = data.nomorSurat ? ` Nomor ${data.nomorSurat}` : '';
    membacaItems.push(`Surat Permohonan dari ${pemohonText}, tanggal ${formatDate(data.tanggalSurat)}${nomorSuratText}.`);
  }
  if (data.membaca.putusanPertama && data.nomorPutusanPertama) {
    membacaItems.push(`Putusan Nomor ${data.nomorPutusanPertama} tanggal ${formatDate(data.tanggalPutusanPertama)}.`);
  }
  if (data.membaca.putusanBanding && data.nomorPutusanBanding) {
    membacaItems.push(`Putusan Banding Nomor ${data.nomorPutusanBanding} tanggal ${formatDate(data.tanggalPutusanBanding)}.`);
  }
  if (data.membaca.putusanKasasi && data.nomorPutusanKasasi) {
    membacaItems.push(`Putusan Kasasi Nomor ${data.nomorPutusanKasasi} tanggal ${formatDate(data.tanggalPutusanKasasi)}.`);
  }
  if (data.membaca.putusanPK && data.nomorPutusanPK) {
    membacaItems.push(`Putusan Peninjauan Kembali Nomor ${data.nomorPutusanPK} tanggal ${formatDate(data.tanggalPutusanPK)}.`);
  }
  if (data.membaca.berkasPerkara && data.nomorPerkara) {
    membacaItems.push(`Berkas Perkara Nomor ${data.nomorPerkara}.`);
  }

  const membacaSection = membacaItems.length > 0 
    ? `MEMBACA:\n${membacaItems.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    : 'MEMBACA:\n[Tidak ada data yang dipilih]';

  const tembusanSection = (data.jenisDokumen === 'Surat' && data.tembusan)
    ? `TEMBUSAN:\n${data.tembusan.split('\n').map(t => `- ${t.trim()}`).join('\n')}`
    : '';

  let riwayatPerkara: string[] = [];
  if (data.nomorPutusanPertama) {
    riwayatPerkara.push(`
- Putusan Tingkat Pertama:
  - Nomor: ${data.nomorPutusanPertama}
  - Tanggal: ${formatDate(data.tanggalPutusanPertama)}
  - Amar: ${data.amarPutusanPertama || '[Tidak diisi]'}`);
  }
  if (data.nomorPutusanBanding) {
    riwayatPerkara.push(`
- Putusan Tingkat Banding:
  - Nomor: ${data.nomorPutusanBanding}
  - Tanggal: ${formatDate(data.tanggalPutusanBanding)}
  - Amar: ${data.amarPutusanBanding || '[Tidak diisi]'}`);
  }
  if (data.nomorPutusanKasasi) {
    riwayatPerkara.push(`
- Putusan Tingkat Kasasi:
  - Nomor: ${data.nomorPutusanKasasi}
  - Tanggal: ${formatDate(data.tanggalPutusanKasasi)}
  - Amar: ${data.amarPutusanKasasi || '[Tidak diisi]'}`);
  }
  if (data.nomorPutusanPK) {
    riwayatPerkara.push(`
- Putusan Peninjauan Kembali:
  - Nomor: ${data.nomorPutusanPK}
  - Tanggal: ${formatDate(data.tanggalPutusanPK)}
  - Amar: ${data.amarPutusanPK || '[Tidak diisi]'}`);
  }

  const riwayatPerkaraSection = riwayatPerkara.length > 0
    ? `RIWAYAT PERKARA:\n${riwayatPerkara.join('\n')}`
    : '';
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  const prompt = `
    Buatlah draf dokumen hukum resmi Indonesia dengan jenis "${data.jenisDokumen}" berdasarkan informasi berikut.
    Gunakan Bahasa Indonesia yang baku, formal, dan sesuai dengan standar tata naskah dinas di lingkungan peradilan.

    INFORMASI UTAMA:
    - Jenis Dokumen: ${data.jenisDokumen}
    ${data.jenisDokumen === 'Penetapan' && data.jenisPenetapan ? `- Jenis Penetapan: ${data.jenisPenetapan}` : ''}
    ${data.jenisDokumen === 'Berita Acara' && data.jenisBeritaAcara ? `- Jenis Berita Acara: ${data.jenisBeritaAcara}` : ''}
    - Nama Pengadilan: ${data.courtName}
    - Jenis Perkara: ${data.jenisPerkara}
    - Nomor Perkara: ${data.nomorPerkara}
    - Tanggal Dokumen: ${formatDate(data.determinationDate)}
    - Hakim Tunggal: ${data.judgeName}
    - Panitera Pengganti: ${data.clerkName}
    - Permohonan Prodeo: ${data.isProdeo ? 'Ya' : 'Tidak'}

    PARA PIHAK:
    - Pemohon Eksekusi: ${data.pemohonEksekusi}
    - Alamat Pemohon Eksekusi: ${data.alamatPemohonEksekusi}
    - Termohon Eksekusi: ${data.termohonEksekusi}
    - Alamat Termohon Eksekusi: ${data.alamatTermohonEksekusi}

    DETAIL PERMOHONAN:
    - Nomor Surat Permohonan: ${data.nomorSurat || '[Tidak diisi]'}
    - Tanggal Surat Permohonan: ${formatDate(data.tanggalSurat)}
    ${data.namaKuasa ? `- Nama Kuasa: ${data.namaKuasa}` : ''}
    ${data.alamatKuasa ? `- Alamat Kuasa: ${data.alamatKuasa}` : ''}
    ${data.tanggalSuratKuasa ? `- Tanggal Surat Kuasa: ${formatDate(data.tanggalSuratKuasa)}` : ''}

    ${riwayatPerkaraSection}

    SUBSTANSI DOKUMEN:
    
    ${membacaSection}

    MENIMBANG:
    ${data.menimbang || '[Jelaskan pertimbangan hukum berdasarkan fakta dan hukum yang relevan, termasuk riwayat perkara di atas]'}

    MENGINGAT:
    ${data.mengingat || '[Sebutkan pasal-pasal dari peraturan perundang-undangan yang menjadi dasar]'}

    MENETAPKAN:
    ${data.menetapkan || '[Tuliskan amar putusan secara jelas dan terperinci]'}

    ${tembusanSection}

    INSTRUKSI:
    1.  Susun informasi di atas menjadi sebuah dokumen ${data.jenisDokumen} yang lengkap dan koheren.
    2.  Jika jenis penetapan atau berita acara spesifik (misal: Berita Acara Aanmaning), sesuaikan judul dan isi dokumen agar relevan.
    3.  Pastikan semua bagian (kop, judul, identitas, isi, penutup) tersusun dengan benar.
    4.  Untuk Penetapan, sertakan frasa "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA".
    5.  Hasilkan teks lengkap untuk dokumen final.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating document:", error);
    throw new Error("Gagal menghasilkan dokumen. Silakan coba lagi.");
  }
};