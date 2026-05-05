import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  FileText, Image as ImageIcon, Rocket, Plus, Edit3, Download, CheckSquare, Target, 
  BarChart2, Layout, X, ChevronRight, Loader2, Maximize, GripVertical, ArrowUp, ArrowDown, Trash2,
  Bold, Underline, List, Minus, Eraser, FileImage, Sparkles, PlusSquare, User, Palette, Type, Copy, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import generatePDF, { usePDF, Margin } from 'react-to-pdf';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/cropImage';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { api } from '../lib/api';
import { getAI } from '../lib/gemini';
import { GoogleGenAI } from '@google/genai';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { auth, db } from '../firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AFRICAN_COUNTRIES = {
  "Bénin": ["Cotonou", "Porto-Novo", "Parakou", "Abomey"],
  "Burkina Faso": ["Ouagadougou", "Bobo-Dioulasso", "Koudougou"],
  "Cameroun": ["Douala", "Yaoundé", "Garoua", "Bamenda"],
  "Côte d'Ivoire": ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro"],
  "Gabon": ["Libreville", "Port-Gentil", "Franceville"],
  "Mali": ["Bamako", "Sikasso", "Mopti", "Ségou"],
  "Niger": ["Niamey", "Zinder", "Maradi"],
  "Sénégal": ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor"],
  "Togo": ["Lomé", "Sokodé", "Kara", "Kpalimé"],
  // Add more as needed
};


const RichEditableText = ({ value, onSave, className, style = {} }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value || '');
    const editorRef = useRef<HTMLDivElement>(null);

    const handleBlur = (e: any) => {
      // If we clicked on the toolbar, don't blur
      if (e.relatedTarget?.closest('.rich-toolbar')) return;
      
      setIsEditing(false);
      if (editorRef.current) {
        const newValue = editorRef.current.innerHTML;
        setLocalValue(newValue);
        onSave(newValue);
      }
    };

    const execCommand = (command: string, val: string | undefined = undefined) => {
      document.execCommand(command, false, val);
      editorRef.current?.focus();
    };

    if (isEditing) {
      return (
        <div className="relative group/rich w-full">
          <div className="absolute -top-12 left-0 flex items-center gap-1 bg-white shadow-2xl border border-slate-200 p-1.5 rounded-xl z-[100] rich-toolbar animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button 
              onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700" 
              title="Gras"
            >
              <Bold size={16} />
            </button>
            <button 
              onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700" 
              title="Souligné"
            >
              <Underline size={16} />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button 
              onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700" 
              title="Puces"
            >
              <List size={16} />
            </button>
            <button 
              onMouseDown={(e) => { e.preventDefault(); execCommand('insertHorizontalRule'); }} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700" 
              title="Ligne horizontale"
            >
              <Minus size={16} />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button 
              onMouseDown={(e) => { e.preventDefault(); execCommand('removeFormat'); }} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-red-500" 
              title="Effacer la mise en forme"
            >
              <Eraser size={16} />
            </button>
            <button 
              onMouseDown={(e) => { e.preventDefault(); execCommand('undo'); }} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500" 
              title="Annuler"
            >
              <ArrowUp size={16} className="-rotate-90" />
            </button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            autoFocus
            onBlur={handleBlur}
            dangerouslySetInnerHTML={{ __html: localValue }}
            className={`w-full bg-blue-50/50 border-none focus:ring-0 p-2 rounded-xl outline-none min-h-[1.5em] ring-2 ring-blue-500/20 ${className}`}
            style={style}
          />
        </div>
      );
    }

    return (
      <div 
        onClick={() => setIsEditing(true)}
        className={`cursor-text hover:bg-blue-50/30 rounded-lg px-2 -mx-2 transition-colors rich-content ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: value || '<span class="opacity-30 italic">Cliquez pour éditer</span>' }}
      />
    );
  };

const EditableText = ({ value, onSave, className, multiline = false, style = {} }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value || '');

    const handleBlur = () => {
      setIsEditing(false);
      onSave(localValue);
    };

    if (isEditing) {
      return multiline ? (
        <textarea
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className={`w-full bg-blue-50/50 border-none focus:ring-0 p-0 resize-none ${className}`}
          style={style}
        />
      ) : (
        <input
          autoFocus
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className={`w-full bg-blue-50/50 border-none focus:ring-0 p-0 ${className}`}
          style={style}
        />
      );
    }

    return (
      <div 
        onClick={() => setIsEditing(true)}
        className={`cursor-text hover:bg-blue-50/30 rounded px-1 -mx-1 transition-colors ${className}`}
        style={style}
      >
        {value || <span className="opacity-30 italic">Cliquez pour éditer</span>}
      </div>
    );
  };
export default function Tools() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000,
  });

  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUid(user.uid);
      } else {
        if (!auth.currentUser) {
          signInAnonymously(auth).catch((err) => {
            if (err.code === 'auth/admin-restricted-operation') {
              console.warn('Anonymous login not available, please authenticate: ', err.code);
            } else {
              console.error('signInAnonymously failed:', err);
            }
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const syncWithFirestore = async (docId: string, dataObj: any) => {
    if (!firebaseUid) return;
    try {
      await setDoc(doc(db, 'users', firebaseUid, 'documents', docId), {
        uid: firebaseUid,
        data: JSON.stringify(dataObj),
        updatedAt: new Date()
      });
    } catch (err) {
      console.error('Firebase sync error:', err);
    }
  };

  const [activePage, setActivePage] = useState<'dashboard' | 'cv' | 'portfolio' | 'startup'>('dashboard');
  const [activeModal, setActiveModal] = useState<'cv' | 'portfolio' | 'startup' | null>(null);
  
  // State for CV
  const [cvData, setCvData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user_cv');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse user_cv:', e);
      return null;
    }
  });

  const [cvForm, setCvForm] = useState(() => {
    try {
      const saved = localStorage.getItem('user_cv');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.colors) parsed.colors = { primary: '#3b82f6', secondary: '#f1f5f9', text: '#0f172a' };
        if (!parsed.customSections) parsed.customSections = [];
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse user_cv form:', e);
    }
    return {
      nom: '', titre: '', photo: '', resume: '', experience: '', formation: '', competences: '',
      design: 'moderne', email: '', telephone: '', adresse: '', linkedin: '', langues: '', loisirs: '',
      customSections: [], colors: { primary: '#3b82f6', secondary: '#f1f5f9', text: '#0f172a', bodyText: '#334155', sidebarText: '#475569'},
      font: 'Montserrat', boldTitles: true, spacing: 'normal', sidebarPosition: 'left', photoPosition: 'center', sidebarColor: '#f1f5f9', shapes: []
    };
  });

  // State for Portfolio
  const [portfolioData, setPortfolioData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user_portfolio');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse user_portfolio:', e);
      return null;
    }
  });

  const [portfolioForm, setPortfolioForm] = useState(() => {
    try {
      const saved = localStorage.getItem('user_portfolio');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse user_portfolio form:', e);
    }
    return { nom: '', bio: '', projets: '', contact: '', realisations: [] };
  });

  const [realisationDesc, setRealisationDesc] = useState('');
  const [realisationDate, setRealisationDate] = useState('');
  const [newRealisationFile, setNewRealisationFile] = useState<any>(null);


  // State for Startup
  const [startupData, setStartupData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user_startup');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse user_startup:', e);
      return null;
    }
  });

  const [startupForm, setStartupForm] = useState(() => {
    return { projet: '', objectif: '', atouts: '', faiblesses: '', attentes: '', budget: '', pays: '', ville: '' };
  });

  useEffect(() => {
    if (!firebaseUid) return;
    const fetchFromFirebase = async () => {
      try {
        const cvDoc = await getDoc(doc(db, 'users', firebaseUid, 'documents', 'cv'));
        if (cvDoc.exists()) {
          const parsed = JSON.parse(cvDoc.data().data);
          setCvData(parsed);
          setCvForm(parsed);
        }

        const portDoc = await getDoc(doc(db, 'users', firebaseUid, 'documents', 'portfolio'));
        if (portDoc.exists()) {
          const parsed = JSON.parse(portDoc.data().data);
          setPortfolioData(parsed);
          setPortfolioForm(parsed);
        }

        const startDoc = await getDoc(doc(db, 'users', firebaseUid, 'documents', 'startup'));
        if (startDoc.exists()) {
          const parsed = JSON.parse(startDoc.data().data);
          setStartupData(parsed);
          // Set subset if needed, otherwise rely on startupData mainly
        }
      } catch (err) {
        console.error('Initial fetch failed:', err);
      }
    };
    fetchFromFirebase();
  }, [firebaseUid]);

  const [isSavingCv, setIsSavingCv] = useState(false);
  const [cvStep, setCvStep] = useState(1);
  const [cvMode, setCvMode] = useState<'create' | 'import' | null>(null);
  const [cvActiveTab, setCvActiveTab] = useState<'edit' | 'preview'>('edit');
  const [cvEditorTab, setCvEditorTab] = useState<'info' | 'style' | 'sections' | 'shapes'>('info');
  const [cvPreviewScale, setCvPreviewScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth - 32;
        const a4WidthPx = 794;
        const newScale = Math.min(1, containerWidth / a4WidthPx);
        setCvPreviewScale(newScale);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [activeModal, cvActiveTab]);

  const updateField = (field: string, value: any) => {
    const newForm = { ...cvForm, [field]: value };
    setCvForm(newForm);
    syncWithFirestore('cv', newForm);
  };

  const updatePortfolioField = (field: string, value: any) => {
    const newForm = { ...portfolioForm, [field]: value };
    setPortfolioForm(newForm);
    syncWithFirestore('portfolio', newForm);
  };

  
  const { toPDF: toPdfCv, targetRef: cvRef } = usePDF({
    filename: 'mon_cv.pdf',
    page: { format: 'A4', orientation: 'portrait' }
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const handlePreviewPdf = async () => {
    if (!cvRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      // Create PDF using react-to-pdf's generatePDF function which automatically calculates pages
      const pdf = await generatePDF(() => cvRef.current, {
        method: 'build',
        page: { format: 'A4', orientation: 'portrait' },
        canvas: { mimeType: 'image/jpeg', qualityRatio: 1 }
      });
      const blobUrl = pdf.output('bloburl');
      setPdfPreviewUrl(blobUrl.toString());
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération de l\'aperçu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!cvRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      await generatePDF(() => cvRef.current, {
        method: 'save',
        filename: 'mon_cv_professionnel.pdf',
        page: { format: 'A4', orientation: 'portrait' },
        canvas: { mimeType: 'image/jpeg', qualityRatio: 1 }
      });
      toast.success('Export PDF réussi !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPng = async () => {
    if (!cvRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      const dataUrl = await toPng(cvRef.current, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      saveAs(dataUrl, `mon_cv_professionnel.png`);
      toast.success('Export PNG réussi !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export PNG');
    } finally {
      setIsExporting(false);
    }
  };

  // Cropping states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    try {
      if (tempImage && croppedAreaPixels) {
        const croppedImage = await getCroppedImg(tempImage, croppedAreaPixels);
        setCvForm({ ...cvForm, photo: croppedImage });
        setCropModalOpen(false);
        setTempImage(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du rognage de l\'image');
    }
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...cvForm.customSections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newSections.length) {
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
      setCvForm({ ...cvForm, customSections: newSections });
    }
  };
  
  // Old Portfolio hooks moved to top
  const portfolioRef = useRef<HTMLDivElement>(null);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const startupRef = useRef<HTMLDivElement>(null);
  const [portfolioPdfPreviewUrl, setPortfolioPdfPreviewUrl] = useState<string | null>(null);
  const [startupPdfPreviewUrl, setStartupPdfPreviewUrl] = useState<string | null>(null);

  const handlePreviewPortfolioPdf = async () => {
    if (!portfolioRef.current) return;
    setIsExporting(true);
    try {
      const pdf = await generatePDF(() => portfolioRef.current, {
        method: 'build',
        page: { format: 'A4', orientation: 'portrait' },
        canvas: { mimeType: 'image/jpeg', qualityRatio: 1 }
      });
      const blobUrl = pdf.output('bloburl');
      setPortfolioPdfPreviewUrl(blobUrl.toString());
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération de l\'aperçu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPortfolioPdf = async () => {
    if (!portfolioRef.current) return;
    setIsExporting(true);
    try {
      await generatePDF(() => portfolioRef.current, {
        method: 'save',
        filename: 'mon_portfolio.pdf',
        page: { format: 'A4', orientation: 'portrait' },
        canvas: { mimeType: 'image/jpeg', qualityRatio: 1 }
      });
      toast.success('Export PDF réussi !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewStartupPdf = async () => {
    if (!startupRef.current) return;
    setIsExporting(true);
    try {
      const pdf = await generatePDF(() => startupRef.current, {
        method: 'build',
        page: { format: 'A4', orientation: 'portrait' },
        canvas: { mimeType: 'image/jpeg', qualityRatio: 1 }
      });
      const blobUrl = pdf.output('bloburl');
      setStartupPdfPreviewUrl(blobUrl.toString());
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération de l\'aperçu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportStartupPdf = async () => {
    if (!startupRef.current) return;
    setIsExporting(true);
    try {
      await generatePDF(() => startupRef.current, {
        method: 'save',
        filename: 'ma_startup.pdf',
        page: { format: 'A4', orientation: 'portrait' },
        canvas: { mimeType: 'image/jpeg', qualityRatio: 1 }
      });
      toast.success('Export PDF réussi !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setIsExporting(false);
    }
  };
  
  const [isGeneratingStartup, setIsGeneratingStartup] = useState(false);

  const [activeSubModule, setActiveSubModule] = useState<'page' | 'plan' | 'defis' | 'marche' | null>(null);
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [isGeneratingDefis, setIsGeneratingDefis] = useState(false);
  const [isGeneratingMarche, setIsGeneratingMarche] = useState(false);
  const [pageViewMode, setPageViewMode] = useState<'edit' | 'preview'>('edit');

  const handleImprovePage = async () => {
    setIsGeneratingPage(true);
    try {
      const ai = getAI();
      const prompt = `Agis en tant qu'expert en levée de fonds et Venture Capital. Améliore de manière exceptionnelle le pitch suivant pour le rendre irrésistible devant des investisseurs.
      
      Pitch actuel: ${startupData.pitch || ''}
      Problème actuel: ${startupData.probleme || ''}
      Solution actuelle: ${startupData.solution || ''}
      Équipe actuelle: ${startupData.equipe || ''}
      
      Focus impératif sur :
      1. Le problème : met en lumière la douleur client (douleur immédiate et chiffrée si possible).
      2. La solution : proposition de valeur unique, avantage concurrentiel clair et proposition de scalabilité.
      3. L'ambition : vision du marché et potentiel de croissance.
      
      Génère une structure JSON concise avec les clés : 
      - pitch (un 'elevator pitch' court, percutant et mémorable)
      - probleme (très orienté douleur client)
      - solution (très orientée proposition de valeur et différenciation)
      - equipe (mettant en avant la complémentarité et l'expertise dévastatrice)
      
      Le ton doit être audacieux, professionnel, visionnaire et ultra-convaincant. Ne renvoie que le JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const generatedData = JSON.parse(response.text || '{}');
      setStartupData({ ...startupData, ...generatedData });
      toast.success('Contenu amélioré par l\'IA !', { icon: '✨' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'amélioration.');
    } finally {
      setIsGeneratingPage(false);
    }
  };

  const handleGenerateDefis = async () => {
    setIsGeneratingDefis(true);
    try {
      const ai = getAI();
      const prompt = `Génère 3 nouveaux défis quotidiens actionnables pour faire avancer cette startup.
      Projet: ${startupData.projet}
      Objectif: ${startupData.objectif}
      
      Génère un tableau JSON de strings représentant les défis. Ne renvoie que le JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const generatedData = JSON.parse(response.text || '[]');
      setStartupData({ 
        ...startupData, 
        defis: generatedData.map((d: any) => ({ description: d, completed: false })) 
      });
      toast.success('Nouveaux défis générés !', { icon: '🎯' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération.');
    } finally {
      setIsGeneratingDefis(false);
    }
  };

  const handleDeepenMarche = async () => {
    setIsGeneratingMarche(true);
    try {
      const ai = getAI();
      const prompt = `Approfondis l'analyse de marché pour cette startup.
      Projet: ${startupData.projet}
      Pays: ${startupData.pays}
      
      Génère une structure JSON avec:
      - concurrents: tableau de 5 concurrents potentiels ou types de concurrents détaillés
      - segments: tableau de 4 segments clients très spécifiques
      - swot: objet with forces, faiblesses, opportunites, menaces (tableaux de 4 strings chacun)
      Ne renvoie que le JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const generatedData = JSON.parse(response.text || '{}');
      setStartupData({ ...startupData, marche: generatedData });
      toast.success('Analyse de marché approfondie !', { icon: '📊' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'analyse.');
    } finally {
      setIsGeneratingMarche(false);
    }
  };

  const toggleTask = (index: number) => {
    const newPlan = [...(startupData.planAction || [])];
    if (newPlan[index]) {
      newPlan[index].completed = !newPlan[index].completed;
      setStartupData({ ...startupData, planAction: newPlan });
    }
  };

  const toggleDefi = (index: number) => {
    const newDefis = [...(startupData.defis || [])];
    if (newDefis[index]) {
      if (typeof newDefis[index] === 'string') {
        newDefis[index] = { description: newDefis[index], completed: true };
      } else {
        newDefis[index].completed = !newDefis[index].completed;
      }
      setStartupData({ ...startupData, defis: newDefis });
    }
  };

  const handleExportFullStartup = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 20;
      let y = margin;
      
      pdf.setFontSize(24);
      pdf.text(`Projet: ${startupData.projet}`, margin, y);
      y += 15;
      
      pdf.setFontSize(14);
      pdf.text(`Pitch:`, margin, y);
      y += 7;
      pdf.setFontSize(10);
      const pitchLines = pdf.splitTextToSize(startupData.pitch || '', 170);
      pdf.text(pitchLines, margin, y);
      y += (pitchLines.length * 5) + 10;
      
      pdf.setFontSize(14);
      pdf.text(`Le Problème:`, margin, y);
      y += 7;
      pdf.setFontSize(10);
      const probLines = pdf.splitTextToSize(startupData.probleme || '', 170);
      pdf.text(probLines, margin, y);
      y += (probLines.length * 5) + 10;
      
      pdf.setFontSize(14);
      pdf.text(`La Solution:`, margin, y);
      y += 7;
      pdf.setFontSize(10);
      const solLines = pdf.splitTextToSize(startupData.solution || '', 170);
      pdf.text(solLines, margin, y);
      y += (solLines.length * 5) + 10;
      
      // Check for page overflow
      if (y > 250) { pdf.addPage(); y = margin; }
      
      pdf.setFontSize(14);
      pdf.text(`Plan d'Action:`, margin, y);
      y += 10;
      pdf.setFontSize(10);
      startupData.planAction?.forEach((task: any, i: number) => {
        if (y > 270) { pdf.addPage(); y = margin; }
        pdf.text(`- ${task.titre || task.title}: ${task.description}`, margin, y);
        y += 7;
      });
      
      y += 10;
      if (y > 250) { pdf.addPage(); y = margin; }
      
      pdf.setFontSize(14);
      pdf.text(`Analyse de Marché:`, margin, y);
      y += 7;
      if (startupData.marche) {
        pdf.setFontSize(10);
        pdf.text(`Segments: ${startupData.marche.segments?.join(', ')}`, margin, y);
        y += 7;
        pdf.text(`Concurrents: ${startupData.marche.concurrents?.join(', ')}`, margin, y);
        y += 10;
      }
      
      pdf.save(`startup_${startupData.projet.replace(/\s+/g, '_')}.pdf`);
      toast.success('Projet complet exporté !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };
  const handleRealisationFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewRealisationFile({ file: reader.result as string, type: file.type.startsWith('image/') ? 'image' : 'video' });
      };
      reader.readAsDataURL(file);
    }
  };

  const addRealisation = () => {
    if (!realisationDesc || !realisationDate || !newRealisationFile) {
      toast.error('Veuillez remplir tous les champs de la réalisation');
      return;
    }
    setPortfolioForm(prev => ({
      ...prev,
      realisations: [...(prev.realisations || []), { ...newRealisationFile, description: realisationDesc, date: realisationDate }]
    }));
    setRealisationDesc('');
    setRealisationDate('');
    setNewRealisationFile(null);
    toast.success('Réalisation ajoutée avec succès !');
  };

  const handlePortfolioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPortfolio(true);
    setPortfolioData(portfolioForm);
    localStorage.setItem('user_portfolio', JSON.stringify(portfolioForm));
    syncWithFirestore('portfolio', portfolioForm);
    setIsSavingPortfolio(false);
    setActiveModal(null);
    toast.success('Portfolio enregistré avec succès !');
  };

  const handleStartupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startupForm.projet || !startupForm.pays || !startupForm.ville) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }

    setIsGeneratingStartup(true);
    try {
      const ai = getAI();
      const prompt = `En tant qu'expert en création d'entreprise et stratégie d'affaires, analyse ce projet de startup et structure-le.
      
      Projet: ${startupForm.projet}
      Objectif: ${startupForm.objectif}
      Atouts: ${startupForm.atouts}
      Faiblesses: ${startupForm.faiblesses}
      Attentes: ${startupForm.attentes}
      Budget: ${startupForm.budget}
      Localisation: ${startupForm.ville}, ${startupForm.pays}
      
      Génère une structure JSON avec les éléments suivants:
      - pitch: Un pitch elevator percutant (2-3 phrases)
      - probleme: Le problème principal résolu
      - solution: La solution proposée
      - equipe: Les rôles clés nécessaires
      - planAction: Un tableau de 5 tâches concrètes pour démarrer (avec id, titre, description, completed: false)
      - defis: Un tableau de 3 défis quotidiens pour la première semaine
      - marche: Un objet contenant: concurrents (tableau de 3 types de concurrents), segments (tableau de 3 segments clients), swot (objet avec forces, faiblesses, opportunites, menaces - tableaux de strings)
      Ne renvoie que le JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const generatedData = JSON.parse(response.text || '{}');
      const finalData = { ...startupForm, ...generatedData };
      setStartupData(finalData);
      localStorage.setItem('user_startup', JSON.stringify(finalData));
      syncWithFirestore('startup', finalData);
      setActiveModal(null);
      toast.success('Projet structuré avec succès !', { icon: '🚀' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération. Veuillez réessayer.');
    } finally {
      setIsGeneratingStartup(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      {activePage === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => {
              if (cvData) setActivePage('cv');
              else setActiveModal('cv');
            }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group"
          >
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText size={32} />
            </div>
            <div className="text-center">
              <h3 className="font-black text-slate-900 text-lg">{cvData ? 'Voir Mon CV' : 'Créer mon CV'}</h3>
              <p className="text-sm text-slate-500">{cvData ? 'Visualiser et exporter' : 'Générez un CV'}</p>
            </div>
          </button>

          <button 
            onClick={() => {
              if (portfolioData) setActivePage('portfolio');
              else setActiveModal('portfolio');
            }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group"
          >
            <div className="w-16 h-16 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ImageIcon size={32} />
            </div>
            <div className="text-center">
              <h3 className="font-black text-slate-900 text-lg">{portfolioData ? 'Voir Mon Portfolio' : 'Créer mon Portfolio'}</h3>
              <p className="text-sm text-slate-500">{portfolioData ? 'Visualiser et exporter' : 'Mettez en valeur mes projets'}</p>
            </div>
          </button>

          <button 
            onClick={() => {
              if (startupData) setActivePage('startup');
              else setActiveModal('startup');
            }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3 group border border-slate-700"
          >
            <div className="w-16 h-16 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Rocket size={32} />
            </div>
            <div className="text-center">
              <h3 className="font-black text-white text-lg">{startupData ? 'Voir Ma Startup' : 'Lancer ma Startup'}</h3>
              <p className="text-sm text-slate-400">{startupData ? 'Visualiser, exporter et gérer' : 'Structuration IA'}</p>
            </div>
          </button>
        </div>
      )}

      
      {/* Content Sections */}
      <div className="space-y-12">
        {/* CV Section */}
        {activePage === 'cv' && cvData && (
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setActivePage('dashboard')} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <FileText className="text-blue-500" /> Mon CV
                </h2>
              </div>
              <div className="flex gap-2">
              <select 
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                value={cvForm.design}
                onChange={e => setCvForm({...cvForm, design: e.target.value})}
              >
                {['moderne', 'creatif', 'minimaliste', 'elegant', 'brutaliste', 'futuriste', 'corporate', 'artisan'].map(d => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
              <div className="relative flex gap-2">
                <button 
                  onClick={handlePreviewPdf} 
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors hidden sm:flex"
                  title="Aperçu avant exportation"
                >
                  {isExporting && !pdfPreviewUrl ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />} Aperçu PDF
                </button>
                <button 
                  onClick={() => setExportMenuOpen(!exportMenuOpen)} 
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  <Download size={18} /> Exporter
                </button>
                <AnimatePresence>
                  {exportMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50"
                    >
                      <button 
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors text-left text-sm font-bold text-slate-700 disabled:opacity-50"
                      >
                        {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} className="text-blue-500" />}
                        PDF (.pdf)
                      </button>
                      <button 
                        onClick={handleExportPng}
                        disabled={isExporting}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors text-left text-sm font-bold text-slate-700 disabled:opacity-50"
                      >
                        {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileImage size={18} className="text-purple-500" />}
                        PNG (.png)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => {
                const element = cvRef.current;
                if (element?.requestFullscreen) element.requestFullscreen();
              }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
                <Maximize size={18} /> Aperçu Plein Écran
              </button>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex w-full bg-slate-100 p-1.5 rounded-2xl mb-4">
              <button 
                onClick={() => setCvActiveTab('edit')}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${cvActiveTab === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                Éditeur
              </button>
              <button 
                onClick={() => setCvActiveTab('preview')}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${cvActiveTab === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                Aperçu
              </button>
            </div>

            {/* Editor Area */}
            <div className={`w-full lg:w-1/2 space-y-6 ${cvActiveTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
              {/* Editor Tabs */}
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto scrollbar-hide">
                {[
                  { id: 'info', label: 'Infos', icon: Edit3 },
                  { id: 'style', label: 'Design', icon: Sparkles },
                  { id: 'sections', label: 'Sections', icon: Layout },
                  { id: 'shapes', label: 'Formes', icon: PlusSquare }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCvEditorTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${cvEditorTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {cvEditorTab === 'info' && (
                  <motion.div 
                    key="info"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                          <User size={20} />
                        </div>
                        <h3 className="font-black text-slate-900 text-lg">Informations Personnelles</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                          <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium" placeholder="Ex: Jean Dupont" value={cvForm.nom} onChange={e => setCvForm({...cvForm, nom: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre Professionnel</label>
                          <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium" placeholder="Ex: Développeur Fullstack" value={cvForm.titre} onChange={e => setCvForm({...cvForm, titre: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                          <input type="email" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium" value={cvForm.email} onChange={e => setCvForm({...cvForm, email: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Téléphone</label>
                          <input type="tel" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium" value={cvForm.telephone} onChange={e => setCvForm({...cvForm, telephone: e.target.value})} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <label className="cursor-pointer bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl font-bold hover:bg-blue-100 transition-all flex items-center gap-2">
                          <ImageIcon size={18} />
                          Changer Photo
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setTempImage(reader.result as string);
                                setCropModalOpen(true);
                              };
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                        {cvForm.photo && (
                          <button 
                            onClick={() => setCvForm({...cvForm, photo: ''})}
                            className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors"
                          >
                            Supprimer la photo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                          <FileText size={20} />
                        </div>
                        <h3 className="font-black text-slate-900 text-lg">Contenu Principal</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Résumé / Profil</label>
                          <textarea className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium min-h-[120px]" placeholder="Décrivez votre parcours en quelques lignes..." value={cvForm.resume} onChange={e => setCvForm({...cvForm, resume: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expérience Professionnelle</label>
                          <textarea className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium min-h-[150px]" placeholder="Détaillez vos expériences marquantes..." value={cvForm.experience} onChange={e => setCvForm({...cvForm, experience: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Formation</label>
                          <textarea className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium min-h-[120px]" placeholder="Diplômes et certifications..." value={cvForm.formation} onChange={e => setCvForm({...cvForm, formation: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {cvEditorTab === 'style' && (
                  <motion.div 
                    key="style"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                          <Palette size={20} />
                        </div>
                        <h3 className="font-black text-slate-900 text-lg">Design & Couleurs</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modèle de Design</label>
                          <select 
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white outline-none font-bold text-sm appearance-none"
                            value={cvForm.design} 
                            onChange={e => setCvForm({...cvForm, design: e.target.value})}
                          >
                            <option value="moderne">Moderne</option>
                            <option value="creatif">Créatif</option>
                            <option value="minimaliste">Minimaliste</option>
                            <option value="elegant">Élégant</option>
                            <option value="brutaliste">Brutaliste</option>
                            <option value="futuriste">Futuriste</option>
                            <option value="corporate">Corporate</option>
                            <option value="artisan">Artisan</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Couleur Primaire</label>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <input 
                              type="color" 
                              className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                              value={cvForm.colors.primary} 
                              onChange={e => setCvForm({...cvForm, colors: {...cvForm.colors, primary: e.target.value}})} 
                            />
                            <span className="text-sm font-mono font-bold text-slate-600 uppercase">{cvForm.colors.primary}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Couleur Sidebar</label>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <input 
                              type="color" 
                              className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                              value={cvForm.sidebarColor} 
                              onChange={e => setCvForm({...cvForm, sidebarColor: e.target.value})} 
                            />
                            <span className="text-sm font-mono font-bold text-slate-600 uppercase">{cvForm.sidebarColor}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Couleur Texte Sidebar</label>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <input 
                              type="color" 
                              className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                              value={cvForm.colors.sidebarText || '#475569'} 
                              onChange={e => setCvForm({...cvForm, colors: {...cvForm.colors, sidebarText: e.target.value}})} 
                            />
                            <span className="text-sm font-mono font-bold text-slate-600 uppercase">{cvForm.colors.sidebarText || '#475569'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                          <Type size={20} />
                        </div>
                        <h3 className="font-black text-slate-900 text-lg">Typographie & Mise en page</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Police de caractères</label>
                          <select 
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white outline-none font-bold text-sm appearance-none"
                            value={cvForm.font} 
                            onChange={e => setCvForm({...cvForm, font: e.target.value})}
                          >
                            <option value="Montserrat">Montserrat (Moderne)</option>
                            <option value="Poppins">Poppins (Friendly)</option>
                            <option value="Plus Jakarta Sans">Jakarta (Tech)</option>
                            <option value="serif">Serif (Classique)</option>
                            <option value="mono">Monospace (Code)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Espacement</label>
                          <select 
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white outline-none font-bold text-sm appearance-none"
                            value={cvForm.spacing} 
                            onChange={e => setCvForm({...cvForm, spacing: e.target.value})}
                          >
                            <option value="compact">Compact</option>
                            <option value="normal">Normal</option>
                            <option value="relaxed">Relaxé</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                          <input 
                            type="checkbox" 
                            id="boldTitles"
                            checked={cvForm.boldTitles}
                            onChange={e => setCvForm({...cvForm, boldTitles: e.target.checked})}
                            className="w-5 h-5 text-blue-600 rounded-lg border-slate-200 focus:ring-blue-500/20"
                          />
                          <label htmlFor="boldTitles" className="text-sm font-bold text-slate-700">Titres en Gras</label>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Position Sidebar</label>
                          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button 
                              onClick={() => setCvForm({...cvForm, sidebarPosition: 'left'})}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${cvForm.sidebarPosition === 'left' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                            >
                              Gauche
                            </button>
                            <button 
                              onClick={() => setCvForm({...cvForm, sidebarPosition: 'right'})}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${cvForm.sidebarPosition === 'right' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                            >
                              Droite
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {cvEditorTab === 'sections' && (
                  <motion.div 
                    key="sections"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                            <Plus size={20} />
                          </div>
                          <h3 className="font-black text-slate-900 text-lg">Sections Personnalisées</h3>
                        </div>
                        <button 
                          onClick={() => setCvForm({...cvForm, customSections: [...cvForm.customSections, {id: Date.now().toString(), title: '', content: '', column: 'main'}]})} 
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <Reorder.Group 
                        axis="y" 
                        values={cvForm.customSections.map((s: any, i: number) => ({...s, id: s.id || `sec-${i}`}))} 
                        onReorder={(newSections) => setCvForm({...cvForm, customSections: newSections})} 
                        className="space-y-4"
                      >
                        {cvForm.customSections.map((section: any, index: number) => {
                          const sectionId = section.id || `sec-${index}`;
                          const itemValue = {...section, id: sectionId};
                          return (
                          <Reorder.Item 
                            key={sectionId} 
                            value={itemValue}
                            className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 relative group cursor-default"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1">
                                  <GripVertical size={20} />
                                </div>
                                <select 
                                  value={section.column || 'main'} 
                                  onChange={e => {
                                    const newSections = [...cvForm.customSections];
                                    newSections[index].column = e.target.value;
                                    setCvForm({...cvForm, customSections: newSections});
                                  }}
                                  className="text-[10px] font-black uppercase bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm outline-none"
                                >
                                  <option value="main">Corps</option>
                                  <option value="sidebar">Latéral</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => moveSection(index, 'up')} disabled={index === 0} className="p-2 hover:bg-white rounded-lg disabled:opacity-30 transition-colors"><ArrowUp size={16} /></button>
                                <button onClick={() => moveSection(index, 'down')} disabled={index === cvForm.customSections.length - 1} className="p-2 hover:bg-white rounded-lg disabled:opacity-30 transition-colors"><ArrowDown size={16} /></button>
                                <button 
                                  onClick={() => {
                                    const newSections = cvForm.customSections.filter((_: any, i: number) => i !== index);
                                    setCvForm({...cvForm, customSections: newSections});
                                  }} 
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                            <input 
                              type="text" 
                              placeholder="Titre de la section" 
                              value={section.title} 
                              onChange={e => {
                                const newSections = [...cvForm.customSections];
                                newSections[index].title = e.target.value;
                                setCvForm({...cvForm, customSections: newSections});
                              }} 
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-bold" 
                            />
                            <textarea 
                              placeholder="Contenu de la section..." 
                              value={section.content} 
                              onChange={e => {
                                const newSections = [...cvForm.customSections];
                                newSections[index].content = e.target.value;
                                setCvForm({...cvForm, customSections: newSections});
                              }} 
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[100px]" 
                            />
                          </Reorder.Item>
                        )})}
                      </Reorder.Group>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                            <Copy size={20} />
                          </div>
                          <h3 className="font-black text-slate-900 text-lg">Gestion des Pages</h3>
                        </div>
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-black">{cvForm.pages || 1} Page(s)</span>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setCvForm({...cvForm, pages: Math.max(1, (cvForm.pages || 1) - 1)})}
                          className="flex-1 py-3 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-100"
                        >
                          Retirer Page
                        </button>
                        <button 
                          onClick={() => setCvForm({...cvForm, pages: (cvForm.pages || 1) + 1})}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                        >
                          Ajouter Page
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {cvEditorTab === 'shapes' && (
                  <motion.div 
                    key="shapes"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                            <PlusSquare size={20} />
                          </div>
                          <h3 className="font-black text-slate-900 text-lg">Formes & Éléments</h3>
                        </div>
                        <button 
                          onClick={() => setCvForm({...cvForm, shapes: [...(cvForm.shapes || []), {
                            id: Date.now(),
                            type: 'rect',
                            x: 10,
                            y: 10,
                            width: 50,
                            height: 50,
                            color: cvForm.colors.primary,
                            borderRadius: 0,
                            zIndex: 1,
                            page: 0
                          }]})}
                          className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {(cvForm.shapes || []).map((shape: any, index: number) => (
                          <motion.div 
                            layout
                            key={shape.id} 
                            className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 relative group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <select 
                                  value={shape.type}
                                  onChange={e => {
                                    const newShapes = [...cvForm.shapes];
                                    newShapes[index].type = e.target.value;
                                    setCvForm({...cvForm, shapes: newShapes});
                                  }}
                                  className="text-[10px] font-black uppercase bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm outline-none"
                                >
                                  <option value="rect">Rectangle</option>
                                  <option value="circle">Cercle</option>
                                  <option value="line">Trait</option>
                                </select>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {shape.page || 0}</span>
                              </div>
                              <button 
                                onClick={() => {
                                  const newShapes = cvForm.shapes.filter((_: any, i: number) => i !== index);
                                  setCvForm({...cvForm, shapes: newShapes});
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">X (mm)</label>
                                <input type="number" className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" value={shape.x} onChange={e => {
                                  const newShapes = [...cvForm.shapes];
                                  newShapes[index].x = Number(e.target.value);
                                  setCvForm({...cvForm, shapes: newShapes});
                                }} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Y (mm)</label>
                                <input type="number" className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" value={shape.y} onChange={e => {
                                  const newShapes = [...cvForm.shapes];
                                  newShapes[index].y = Number(e.target.value);
                                  setCvForm({...cvForm, shapes: newShapes});
                                }} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">L (mm)</label>
                                <input type="number" className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" value={shape.width} onChange={e => {
                                  const newShapes = [...cvForm.shapes];
                                  newShapes[index].width = Number(e.target.value);
                                  setCvForm({...cvForm, shapes: newShapes});
                                }} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">H (mm)</label>
                                <input type="number" className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" value={shape.height} onChange={e => {
                                  const newShapes = [...cvForm.shapes];
                                  newShapes[index].height = Number(e.target.value);
                                  setCvForm({...cvForm, shapes: newShapes});
                                }} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Couleur</label>
                                <input type="color" className="w-full h-8 rounded-lg cursor-pointer border border-slate-200" value={shape.color} onChange={e => {
                                  const newShapes = [...cvForm.shapes];
                                  newShapes[index].color = e.target.value;
                                  setCvForm({...cvForm, shapes: newShapes});
                                }} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Arrondi (px)</label>
                                <input type="number" className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none" value={shape.borderRadius} onChange={e => {
                                  const newShapes = [...cvForm.shapes];
                                  newShapes[index].borderRadius = Number(e.target.value);
                                  setCvForm({...cvForm, shapes: newShapes});
                                }} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Z-Index</label>
                                <select 
                                  value={shape.zIndex}
                                  onChange={e => {
                                    const newShapes = [...cvForm.shapes];
                                    newShapes[index].zIndex = Number(e.target.value);
                                    setCvForm({...cvForm, shapes: newShapes});
                                  }}
                                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                                >
                                  <option value="-10">Arrière-plan</option>
                                  <option value="1">Arrière</option>
                                  <option value="5">Avant</option>
                                  <option value="10">Premier-plan</option>
                                </select>
                              </div>
                            </div>

                            {shape.type === 'line' && (
                              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                <button 
                                  onClick={() => {
                                    const newShapes = [...cvForm.shapes];
                                    newShapes[index].orientation = 'horizontal';
                                    newShapes[index].width = 50;
                                    newShapes[index].height = 1;
                                    setCvForm({...cvForm, shapes: newShapes});
                                  }}
                                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${shape.orientation === 'horizontal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
                                >
                                  Horizontal
                                </button>
                                <button 
                                  onClick={() => {
                                    const newShapes = [...cvForm.shapes];
                                    newShapes[index].orientation = 'vertical';
                                    newShapes[index].width = 1;
                                    newShapes[index].height = 50;
                                    setCvForm({...cvForm, shapes: newShapes});
                                  }}
                                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${shape.orientation === 'vertical' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
                                >
                                  Vertical
                                </button>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview Area */}
            <div 
              ref={previewContainerRef}
              className={`w-full lg:w-1/2 lg:sticky lg:top-24 h-fit ${cvActiveTab === 'edit' ? 'hidden lg:block' : 'block'}`}
            >
              {/* Cropping Modal */}
              <AnimatePresence>
                {cropModalOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white rounded-[32px] overflow-hidden w-full max-w-2xl shadow-2xl"
                    >
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-900">Ajuster la photo</h3>
                        <button onClick={() => setCropModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                          <X size={24} />
                        </button>
                      </div>
                      <div className="relative h-[400px] bg-slate-900">
                        {tempImage && (
                          <Cropper
                            image={tempImage}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                          />
                        )}
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-bold text-slate-600">
                            <span>Zoom</span>
                            <span>{Math.round(zoom * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setCropModalOpen(false)}
                            className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                          >
                            Annuler
                          </button>
                          <button 
                            onClick={handleCropSave}
                            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="bg-slate-200/50 backdrop-blur-sm p-4 sm:p-8 rounded-[40px] border border-white/50 shadow-inner overflow-hidden flex justify-center items-start min-h-[600px] relative">
                {/* PDF Preview Modal */}
                <AnimatePresence>
                  {pdfPreviewUrl && (
                    <motion.div 
                      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="bg-white rounded-[32px] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
                      >
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                          <h3 className="text-xl font-black text-slate-900">Aperçu avant exportation</h3>
                          <button onClick={() => setPdfPreviewUrl(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={24} className="text-slate-500" />
                          </button>
                        </div>
                        <div className="flex-1 bg-slate-100 p-2 sm:p-6">
                           <iframe src={pdfPreviewUrl} className="w-full h-full rounded-2xl shadow-sm bg-white" title="PDF Preview" />
                        </div>
                        <div className="p-6 border-t border-slate-100 flex justify-end gap-4 bg-white">
                          <button onClick={() => setPdfPreviewUrl(null)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Fermer</button>
                          <button onClick={() => handleExportPdf()} disabled={isExporting} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2">
                             {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Confirmer l'export
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Export Loading Overlay */}
                <AnimatePresence>
                  {isExporting && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center rounded-[40px]"
                    >
                      <div className="relative mb-6">
                        <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Download size={24} className="text-blue-600" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-2">Exportation du CV en cours</h3>
                      <p className="text-slate-500 text-center max-w-sm">
                        Veuillez patienter pendant que l'application compile les données d'exportation et génère votre fichier haute qualité.
                      </p>
                      
                      {/* Skeleton loaders in background */}
                      <div className="absolute inset-0 -z-10 overflow-hidden opacity-20 pointer-events-none p-8">
                        <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse flex flex-col gap-4 p-8">
                          <div className="w-1/3 h-12 bg-slate-200 rounded-xl"></div>
                          <div className="w-1/2 h-6 bg-slate-200 rounded-lg"></div>
                          <div className="w-full h-32 bg-slate-200 rounded-xl mt-8"></div>
                          <div className="w-full h-32 bg-slate-200 rounded-xl"></div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div 
                  style={{ 
                    transform: `scale(${cvPreviewScale})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  className="flex flex-col gap-8 items-center origin-top w-full overflow-x-auto pb-32"
                >
                  <div
                    ref={cvRef}
                    style={{
                      color: cvForm.colors.text, 
                      width: '210mm', 
                      minHeight: '297mm',
                      backgroundColor: 'white',
                      fontFamily: cvForm.font === 'serif' ? 'serif' : cvForm.font === 'mono' ? 'monospace' : cvForm.font
                    }} 
                    className={`cv-page shadow-2xl relative ${cvForm.design === 'futuriste' ? 'bg-slate-900 text-white' : ''} ${cvForm.design === 'corporate' ? 'border-l-[10mm] border-l-blue-900' : ''} ${cvForm.design === 'artisan' ? 'border-[1mm] border-dashed border-slate-300' : ''}`}
                  >
                    {/* Shapes */}
                    {(cvForm.shapes || []).map((shape: any) => (
                      <motion.div 
                        key={`${shape.id}-${shape.x}-${shape.y}`}
                        drag={true}
                        dragMomentum={false}
                        onDragEnd={(e, info) => {
                          const mmPerPx = 0.264583333;
                          const deltaXmm = (info.offset.x / cvPreviewScale) * mmPerPx;
                          const deltaYmm = (info.offset.y / cvPreviewScale) * mmPerPx;
                          
                          const newShapes = [...cvForm.shapes];
                          const shapeIndex = newShapes.findIndex(s => s.id === shape.id);
                          if (shapeIndex !== -1) {
                            newShapes[shapeIndex] = {
                              ...newShapes[shapeIndex],
                              x: Number((newShapes[shapeIndex].x + deltaXmm).toFixed(2)),
                              y: Number((newShapes[shapeIndex].y + deltaYmm).toFixed(2))
                            };
                            setCvForm({...cvForm, shapes: newShapes});
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: `${shape.x}mm`,
                          top: `${shape.y}mm`,
                          width: `${shape.width}mm`,
                          height: `${shape.height}mm`,
                          backgroundColor: shape.color,
                          borderRadius: shape.type === 'circle' ? '50%' : `${shape.borderRadius}px`,
                          zIndex: shape.zIndex,
                          cursor: 'move',
                          pointerEvents: 'auto'
                        }}
                      />
                    ))}

                    <div className={`grid min-h-[297mm] h-full ${cvForm.spacing === 'compact' ? 'gap-2' : cvForm.spacing === 'relaxed' ? 'gap-8' : 'gap-4'} ${cvForm.design === 'minimaliste' ? 'grid-cols-1 p-[20mm]' : 'grid-cols-3'}`}>
                      {cvForm.design !== 'minimaliste' && (
                        <div 
                          style={{ backgroundColor: cvForm.sidebarColor }}
                          className={`col-span-1 p-[15mm] space-y-6 ${cvForm.sidebarPosition === 'right' ? 'order-last' : 'order-first'} ${cvForm.design === 'futuriste' ? 'bg-slate-800' : ''}`}
                        >
                          <div className={`flex ${cvForm.photoPosition === 'center' ? 'justify-center' : cvForm.photoPosition === 'right' ? 'justify-end' : 'justify-start'}`}>
                            {cvForm.photo && <img src={cvForm.photo} alt="Photo" className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg" />}
                          </div>
                          <div className="space-y-4">
                            <h3 style={{color: cvForm.colors.sidebarText}} className={`uppercase tracking-wider text-xs border-b border-white/20 pb-1 ${cvForm.boldTitles ? 'font-bold' : 'font-medium'}`}>Coordonnées</h3>
                            <div className="space-y-2" style={{ color: cvForm.colors.sidebarText }}>
                              <div className="text-[10px] flex flex-col">
                                <span className="opacity-50 uppercase text-[8px]">Email</span>
                                <EditableText value={cvForm.email} onSave={(v: string) => updateField('email', v)} />
                              </div>
                              <div className="text-[10px] flex flex-col">
                                <span className="opacity-50 uppercase text-[8px]">Téléphone</span>
                                <EditableText value={cvForm.telephone} onSave={(v: string) => updateField('telephone', v)} />
                              </div>
                              <div className="text-[10px] flex flex-col">
                                <span className="opacity-50 uppercase text-[8px]">Adresse</span>
                                <EditableText value={cvForm.adresse} onSave={(v: string) => updateField('adresse', v)} />
                              </div>
                              <div className="text-[10px] flex flex-col">
                                <span className="opacity-50 uppercase text-[8px]">LinkedIn</span>
                                <EditableText value={cvForm.linkedin} onSave={(v: string) => updateField('linkedin', v)} />
                              </div>
                            </div>
                          </div>

                          {/* Sidebar Custom Sections */}
                          {cvForm.customSections.filter((s: any) => s.column === 'sidebar').map((section: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                              <h3 style={{color: cvForm.colors.sidebarText}} className={`uppercase tracking-wider text-xs border-b border-white/20 pb-1 ${cvForm.boldTitles ? 'font-bold' : 'font-medium'}`}>
                                <RichEditableText 
                                  value={section.title} 
                                  onSave={(v: string) => {
                                    const newSections = [...cvForm.customSections];
                                    const realIdx = cvForm.customSections.indexOf(section);
                                    newSections[realIdx].title = v;
                                    setCvForm({...cvForm, customSections: newSections});
                                  }} 
                                />
                              </h3>
                              <div className="text-[10px] leading-relaxed" style={{ color: cvForm.colors.sidebarText }}>
                                <RichEditableText 
                                  value={section.content} 
                                  onSave={(v: string) => {
                                    const newSections = [...cvForm.customSections];
                                    const realIdx = cvForm.customSections.indexOf(section);
                                    newSections[realIdx].content = v;
                                    setCvForm({...cvForm, customSections: newSections});
                                  }} 
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className={`${cvForm.design === 'minimaliste' ? 'col-span-full' : 'col-span-2'} space-y-6 pt-[20mm] pr-[20mm] pb-[20mm] ${cvForm.sidebarPosition === 'right' ? 'pl-[20mm]' : ''}`}>
                        <div className={`border-b border-slate-200 pb-6 mb-6 ${cvForm.design === 'brutaliste' ? 'border-4 border-black p-4' : ''}`}>
                          <h1 style={{color: cvForm.colors.primary}} className={`uppercase leading-none ${cvForm.boldTitles ? 'font-black' : 'font-bold'} ${cvForm.design === 'brutaliste' ? 'text-5xl' : 'text-4xl'}`}>
                            <EditableText value={cvForm.nom} onSave={(v: string) => updateField('nom', v)} />
                          </h1>
                          <div className="text-xl font-medium mt-2 text-slate-600">
                            <EditableText value={cvForm.titre} onSave={(v: string) => updateField('titre', v)} />
                          </div>
                        </div>
                        
                        {cvForm.resume && (
                          <div className="space-y-2" style={{ pageBreakInside: 'avoid' }}>
                            <h3 style={{color: cvForm.colors.primary}} className={`uppercase tracking-wider text-xs border-b border-slate-200 pb-1 ${cvForm.boldTitles ? 'font-bold' : 'font-medium'}`}>Profil Professionnel</h3>
                            <div className="text-sm leading-relaxed" style={{ color: cvForm.colors.bodyText }}>
                              <RichEditableText value={cvForm.resume} onSave={(v: string) => updateField('resume', v)} />
                            </div>
                          </div>
                        )}
                        
                        {cvForm.experience && (
                          <div className="space-y-2">
                            <h3 style={{color: cvForm.colors.primary}} className={`uppercase tracking-wider text-xs border-b border-slate-200 pb-1 ${cvForm.boldTitles ? 'font-bold' : 'font-medium'}`}>Expérience</h3>
                            <div className="text-sm leading-relaxed" style={{ color: cvForm.colors.bodyText }}>
                              <RichEditableText value={cvForm.experience} onSave={(v: string) => updateField('experience', v)} />
                            </div>
                          </div>
                        )}

                        {cvForm.formation && (
                          <div className="space-y-2" style={{ pageBreakInside: 'avoid' }}>
                            <h3 style={{color: cvForm.colors.primary}} className={`uppercase tracking-wider text-xs border-b border-slate-200 pb-1 ${cvForm.boldTitles ? 'font-bold' : 'font-medium'}`}>Formation</h3>
                            <div className="text-sm leading-relaxed" style={{ color: cvForm.colors.bodyText }}>
                              <RichEditableText value={cvForm.formation} onSave={(v: string) => updateField('formation', v)} />
                            </div>
                          </div>
                        )}
                        
                        {/* Main Column Custom Sections */}
                        <div className="space-y-6">
                          {cvForm.customSections.filter((s: any) => s.column !== 'sidebar').map((section: any, index: number) => (
                            <div key={index} className="space-y-2" style={{ pageBreakInside: 'avoid' }}>
                              <h3 style={{color: cvForm.colors.primary}} className={`uppercase tracking-wider text-xs border-b border-slate-200 pb-1 ${cvForm.boldTitles ? 'font-bold' : 'font-medium'}`}>
                                <RichEditableText 
                                  value={section.title} 
                                  onSave={(v: string) => {
                                    const newSections = [...cvForm.customSections];
                                    const realIdx = cvForm.customSections.indexOf(section);
                                    newSections[realIdx].title = v;
                                    setCvForm({...cvForm, customSections: newSections});
                                  }} 
                                />
                              </h3>
                              <div className="text-sm leading-relaxed" style={{ color: cvForm.colors.bodyText }}>
                                <RichEditableText 
                                  value={section.content} 
                                  onSave={(v: string) => {
                                    const newSections = [...cvForm.customSections];
                                    const realIdx = cvForm.customSections.indexOf(section);
                                    newSections[realIdx].content = v;
                                    setCvForm({...cvForm, customSections: newSections});
                                  }} 
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Section */}
        {activePage === 'portfolio' && portfolioData && (
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setActivePage('dashboard')} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <ImageIcon className="text-purple-500" /> Mon Portfolio
                </h2>
              </div>
              <div className="flex items-center gap-2 relative">
                <button onClick={handlePreviewPortfolioPdf} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl font-bold hover:bg-purple-100 transition-colors hidden sm:flex">
                  {isExporting && !portfolioPdfPreviewUrl ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />} Aperçu PDF
                </button>
                <button onClick={() => setActiveModal('portfolio')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  <Edit3 size={18} /> Éditer
                </button>
                <button onClick={handleExportPortfolioPdf} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  {isExporting && !portfolioPdfPreviewUrl ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Exporter PDF
                </button>
              </div>
            </div>
            
            {/* Portfolio PDF Preview Modal */}
            <AnimatePresence>
              {portfolioPdfPreviewUrl && (
                <motion.div 
                  className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-white rounded-[32px] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
                  >
                    <div className="flex justify-between items-center p-6 border-b border-slate-100">
                      <h3 className="text-xl font-black text-slate-900">Aperçu du Portfolio</h3>
                      <button onClick={() => setPortfolioPdfPreviewUrl(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24} className="text-slate-500" />
                      </button>
                    </div>
                    <div className="flex-1 bg-slate-100 p-2 sm:p-6">
                       <iframe src={portfolioPdfPreviewUrl} className="w-full h-full rounded-2xl shadow-sm bg-white" title="Portfolio Preview" />
                    </div>
                    <div className="p-6 border-t border-slate-100 flex justify-end gap-4 bg-white">
                      <button onClick={() => setPortfolioPdfPreviewUrl(null)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Fermer</button>
                      <button onClick={handleExportPortfolioPdf} disabled={isExporting} className="px-8 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 flex items-center gap-2">
                         {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Confirmer l'export
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={portfolioRef} className="p-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-center border-b border-slate-200 pb-8 mb-8">
                <h1 className="text-4xl font-black text-slate-900">{portfolioData.nom || 'Votre Nom'}</h1>
                <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">{portfolioData.bio || 'Votre bio...'}</p>
                {portfolioData.contact && (
                  <p className="text-purple-600 font-medium mt-4">{portfolioData.contact}</p>
                )}
              </div>
              
              {portfolioData.projets && (
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">Projets Réalisés</h3>
                  <div className="text-slate-600 whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl">{portfolioData.projets}</div>
                </div>
              )}
              {portfolioData.realisations && portfolioData.realisations.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center mt-8">Mes Réalisations</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {portfolioData.realisations.map((r: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl">
                          <p className="font-bold">{r.description}</p>
                          <p className="text-xs text-slate-500">{r.date}</p>
                          {r.type === 'image' ? <img src={r.file} className="w-full h-32 object-cover rounded-lg mt-2" /> : <video src={r.file} className="w-full h-32 object-cover rounded-lg mt-2" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Startup Section */}
        {activePage === 'startup' && startupData && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setActivePage('dashboard')} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <h2 className="text-2xl font-black text-slate-900">Retour au tableau de bord</h2>
            </div>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[32px] p-8 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black mb-2">Ma Startup</h2>
                  <p className="text-emerald-50 text-lg max-w-2xl">
                    Gérez vos projets, suivez votre plan d'action et analysez votre marché.
                  </p>
                </div>
                <button 
                  onClick={() => handleExportFullStartup()}
                  className="px-6 py-3 bg-white text-emerald-600 rounded-2xl font-bold shadow-xl hover:bg-emerald-50 transition-all flex items-center gap-2 shrink-0"
                >
                  <Download size={20} />
                  Exporter Projet Complet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Page Startup */}
              <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-3xl shadow-sm border border-blue-100 hover:shadow-md hover:-translate-y-1 transition-all group">
                <div className="w-14 h-14 bg-blue-500 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                  <Layout size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Page Startup</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">Pitch, Problème, Solution, Équipe. Prévisualisez votre landing page.</p>
                <button onClick={() => setActiveSubModule('page')} className="w-full py-3 bg-white text-blue-600 font-bold rounded-xl border border-blue-100 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                  Ouvrir le module <ChevronRight size={18} />
                </button>
              </div>

              {/* Plan d'Action */}
              <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-3xl shadow-sm border border-emerald-100 hover:shadow-md hover:-translate-y-1 transition-all group">
                <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                  <CheckSquare size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Plan d'Action</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">Suivi des tâches et objectifs générés par l'IA.</p>
                <button onClick={() => setActiveSubModule('plan')} className="w-full py-3 bg-white text-emerald-600 font-bold rounded-xl border border-emerald-100 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
                  Ouvrir le module <ChevronRight size={18} />
                </button>
              </div>

              {/* Défis Quotidiens */}
              <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-3xl shadow-sm border border-orange-100 hover:shadow-md hover:-translate-y-1 transition-all group">
                <div className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                  <Target size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Défis Quotidiens</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">Faites avancer votre projet chaque jour avec des défis progressifs.</p>
                <button onClick={() => setActiveSubModule('defis')} className="w-full py-3 bg-white text-orange-600 font-bold rounded-xl border border-orange-100 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2">
                  Ouvrir le module <ChevronRight size={18} />
                </button>
              </div>

              {/* Analyse de Marché */}
              <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-3xl shadow-sm border border-purple-100 hover:shadow-md hover:-translate-y-1 transition-all group">
                <div className="w-14 h-14 bg-purple-500 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                  <BarChart2 size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Analyse de Marché</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">Étude des concurrents, segments clients et matrice SWOT.</p>
                <button onClick={() => setActiveSubModule('marche')} className="w-full py-3 bg-white text-purple-600 font-bold rounded-xl border border-purple-100 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2">
                  Ouvrir le module <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal === 'cv' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900">Éditeur de CV</h2>
                <button onClick={() => setActiveModal(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto">
                {!cvMode ? (
                  <div className="space-y-4">
                    <button onClick={() => setCvMode('create')} className="w-full p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl text-left hover:border-blue-300 transition-all">
                      <h3 className="font-bold text-blue-900">Créer un nouveau CV</h3>
                      <p className="text-sm text-blue-600">Interface guidée et modèles professionnels</p>
                    </button>
                    <button onClick={() => setCvMode('import')} className="w-full p-6 bg-purple-50 border-2 border-purple-100 rounded-2xl text-left hover:border-purple-300 transition-all">
                      <h3 className="font-bold text-purple-900">Importer un CV existant</h3>
                      <p className="text-sm text-purple-600">Modifiez et optimisez votre CV actuel</p>
                    </button>
                  </div>
                ) : cvMode === 'import' ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Uploader votre CV (PDF/DOCX)</label>
                    <input type="file" accept=".pdf,.docx" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                    <button onClick={() => setCvMode(null)} className="text-slate-500 font-bold">Retour</button>
                  </div>
                ) : (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (cvStep === 1) {
                      if (!cvForm.design) {
                        toast.error('Veuillez sélectionner un design');
                        return;
                      }
                      setCvStep(2);
                    } else {
                      setIsSavingCv(true);
                      setTimeout(() => {
                        setCvData(cvForm);
                        localStorage.setItem('user_cv', JSON.stringify(cvForm));
                        syncWithFirestore('cv', cvForm);
                        setIsSavingCv(false);
                        setActiveModal(null);
                        setCvStep(1);
                        setCvMode(null);
                        toast.success('CV enregistré avec succès !');
                      }, 800);
                    }
                  }} className="space-y-4">
                    {cvStep === 1 ? (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-4">Choisissez un design ultra moderne et professionnel suggéré par l'IA</label>
                        <div className="grid grid-cols-2 gap-4">
                          {['moderne', 'creatif', 'minimaliste', 'elegant', 'brutaliste'].map(design => (
                            <button
                              key={design}
                              type="button"
                              onClick={() => setCvForm({...cvForm, design})}
                              className={`p-4 rounded-2xl border-2 transition-all ${cvForm.design === design ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                              <div className="font-bold capitalize">{design}</div>
                              <div className="text-xs text-slate-500">Design {design} conforme aux standards</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Form Column */}
                        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Nom Complet *</label>
                              <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.nom} onChange={e => setCvForm({...cvForm, nom: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Titre Professionnel *</label>
                              <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.titre} onChange={e => setCvForm({...cvForm, titre: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                              <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.email} onChange={e => setCvForm({...cvForm, email: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Téléphone</label>
                              <input type="tel" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.telephone} onChange={e => setCvForm({...cvForm, telephone: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Adresse</label>
                              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.adresse} onChange={e => setCvForm({...cvForm, adresse: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">LinkedIn</label>
                              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.linkedin} onChange={e => setCvForm({...cvForm, linkedin: e.target.value})} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Photo (Ajustable)</label>
                            <input type="file" accept="image/*" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setCvForm({...cvForm, photo: reader.result as string});
                                reader.readAsDataURL(file);
                              }
                            }} />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Résumé</label>
                            <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[100px]" value={cvForm.resume} onChange={e => setCvForm({...cvForm, resume: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Expérience Professionnelle</label>
                            <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[120px]" value={cvForm.experience} onChange={e => setCvForm({...cvForm, experience: e.target.value})} placeholder="Ex: Développeur Web chez XYZ (2020-2023)..." />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Formation</label>
                            <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[100px]" value={cvForm.formation} onChange={e => setCvForm({...cvForm, formation: e.target.value})} placeholder="Ex: Master en Informatique..." />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Compétences</label>
                            <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[80px]" value={cvForm.competences} onChange={e => setCvForm({...cvForm, competences: e.target.value})} placeholder="Ex: React, Node.js, Gestion de projet..." />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Langues</label>
                            <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.langues} onChange={e => setCvForm({...cvForm, langues: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Loisirs</label>
                            <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={cvForm.loisirs} onChange={e => setCvForm({...cvForm, loisirs: e.target.value})} />
                          </div>
                        </div>

                        {/* Preview Column */}
                        <div className="bg-slate-50 p-6 rounded-2xl overflow-y-auto max-h-[70vh] border border-slate-200">
                          <h4 className="font-bold text-slate-900 mb-4">Prévisualisation</h4>
                          <div className={`p-6 bg-white rounded-xl border border-slate-100 shadow-sm ${cvForm.design === 'moderne' ? 'font-sans' : cvForm.design === 'creatif' ? 'font-serif' : cvForm.design === 'minimaliste' ? 'font-mono' : cvForm.design === 'elegant' ? 'font-serif italic' : 'font-sans uppercase'}`}>
                            {/* Simplified Preview based on selected design */}
                            <div className="border-b border-slate-200 pb-4 mb-4">
                              <h1 className="text-2xl font-black text-slate-900">{cvForm.nom || 'Nom'}</h1>
                              <p className="text-blue-600 font-medium">{cvForm.titre || 'Titre'}</p>
                            </div>
                            <div className="space-y-4 text-sm">
                              {cvForm.resume && <div><h5 className="font-bold text-slate-900">Résumé</h5><p className="text-slate-600">{cvForm.resume}</p></div>}
                              {cvForm.experience && <div><h5 className="font-bold text-slate-900">Expérience</h5><p className="text-slate-600">{cvForm.experience}</p></div>}
                            </div>
                          </div>
                        </div>
                      </div>
                      </>
                    )}
                    
                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                      <button type="button" onClick={() => {
                        if (cvStep === 2) setCvStep(1);
                        else setCvMode(null);
                      }} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">
                        {cvStep === 2 ? 'Retour' : 'Annuler'}
                      </button>
                      <button type="submit" disabled={isSavingCv} className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 flex items-center gap-2 disabled:opacity-70">
                        {isSavingCv ? <Loader2 size={18} className="animate-spin" /> : null}
                        {cvStep === 1 ? 'Suivant' : 'Enregistrer'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {activeModal === 'portfolio' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900">Éditeur de Portfolio</h2>
                <button onClick={() => setActiveModal(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto">
                <form onSubmit={handlePortfolioSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nom ou Pseudo *</label>
                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none" value={portfolioForm.nom} onChange={e => setPortfolioForm({...portfolioForm, nom: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Bio / Présentation</label>
                    <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none min-h-[100px]" value={portfolioForm.bio} onChange={e => setPortfolioForm({...portfolioForm, bio: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Réalisations</label>
                    <div className="space-y-4">
                      {portfolioForm.realisations?.map((r: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="font-bold text-sm">{r.description} ({r.date})</p>
                          {r.type === 'image' ? <img src={r.file} className="w-16 h-16 object-cover rounded-lg mt-2" /> : <video src={r.file} className="w-16 h-16 object-cover rounded-lg mt-2" />}
                        </div>
                      ))}
                      <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                        <input type="text" className="w-full px-4 py-2 border rounded-lg" placeholder="Descriptif" onChange={e => {
                          // Temporary state for new realization
                          setRealisationDesc(e.target.value)
                        }} />
                        <input type="date" className="w-full px-4 py-2 border rounded-lg" onChange={e => setRealisationDate(e.target.value)} />
                        <input type="file" accept="image/*,video/*" onChange={handleRealisationFile} />
                        <button type="button" onClick={addRealisation} className="px-4 py-2 bg-purple-500 text-white rounded-lg">Ajouter</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Contact & Liens</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none" value={portfolioForm.contact} onChange={e => setPortfolioForm({...portfolioForm, contact: e.target.value})} placeholder="Email, LinkedIn, GitHub..." />
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setActiveModal(null)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Annuler</button>
                    <button type="submit" disabled={isSavingPortfolio} className="px-6 py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 flex items-center gap-2 disabled:opacity-70">
                      {isSavingPortfolio ? <Loader2 size={18} className="animate-spin" /> : null}
                      Enregistrer
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {activeModal === 'startup' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Rocket className="text-emerald-500" /> Lancer ma Startup
                </h2>
                <button onClick={() => setActiveModal(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto">
                <form onSubmit={handleStartupSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Nom ou description courte du projet *</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        value={startupForm.projet}
                        onChange={e => setStartupForm({...startupForm, projet: e.target.value})}
                        placeholder="Ex: Plateforme de livraison écologique"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Objectif principal</label>
                      <textarea 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all min-h-[80px]"
                        value={startupForm.objectif}
                        onChange={e => setStartupForm({...startupForm, objectif: e.target.value})}
                        placeholder="Que souhaitez-vous accomplir ?"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Mes atouts</label>
                        <textarea 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all min-h-[80px]"
                          value={startupForm.atouts}
                          onChange={e => setStartupForm({...startupForm, atouts: e.target.value})}
                          placeholder="Compétences, réseau, ressources..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Mes faiblesses</label>
                        <textarea 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all min-h-[80px]"
                          value={startupForm.faiblesses}
                          onChange={e => setStartupForm({...startupForm, faiblesses: e.target.value})}
                          placeholder="Ce qui vous manque actuellement..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Mes attentes</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          value={startupForm.attentes}
                          onChange={e => setStartupForm({...startupForm, attentes: e.target.value})}
                          placeholder="Financement, associés, visibilité..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Budget estimé</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          value={startupForm.budget}
                          onChange={e => setStartupForm({...startupForm, budget: e.target.value})}
                          placeholder="Ex: 5000€, À définir..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Pays *</label>
                        <select 
                          required
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          value={startupForm.pays}
                          onChange={e => setStartupForm({...startupForm, pays: e.target.value, ville: ''})}
                        >
                          <option value="">Sélectionner un pays</option>
                          {Object.keys(AFRICAN_COUNTRIES).sort().map(country => (
                            <option key={country} value={country}>{country}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Ville *</label>
                        <select 
                          required
                          disabled={!startupForm.pays}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:opacity-50"
                          value={startupForm.ville}
                          onChange={e => setStartupForm({...startupForm, ville: e.target.value})}
                        >
                          <option value="">Sélectionner une ville</option>
                          {startupForm.pays && AFRICAN_COUNTRIES[startupForm.pays as keyof typeof AFRICAN_COUNTRIES]?.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button type="button" onClick={() => setActiveModal(null)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
                      Annuler
                    </button>
                    <button 
                      type="submit" 
                      disabled={isGeneratingStartup}
                      className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-70"
                    >
                      {isGeneratingStartup ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Structuration en cours...</>
                      ) : (
                        <><Rocket size={18} /> Lancer l'analyse IA</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Sub-module Modals */}
        {activeSubModule === 'page' && startupData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveSubModule(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Layout className="text-blue-500" /> Page Startup
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPageViewMode(pageViewMode === 'edit' ? 'preview' : 'edit')}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 text-sm transition-colors"
                  >
                    {pageViewMode === 'edit' ? 'Prévisualiser' : 'Éditer'}
                  </button>
                  <button onClick={() => setActiveSubModule(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                {pageViewMode === 'edit' ? (
                  <>
                    <div className="flex justify-end">
                      <button 
                        onClick={handleImprovePage}
                        disabled={isGeneratingPage}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
                      >
                        {isGeneratingPage ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <Rocket size={16} />}
                        Améliorer avec l'IA
                      </button>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-2">Pitch</h3>
                      <textarea 
                        className="w-full p-4 bg-slate-50 text-slate-900 rounded-2xl border border-slate-200 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={startupData.pitch || ''}
                        onChange={(e) => setStartupData({...startupData, pitch: e.target.value})}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-2">Le Problème</h3>
                      <textarea 
                        className="w-full p-4 bg-slate-50 text-slate-900 rounded-2xl border border-slate-200 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={startupData.probleme || ''}
                        onChange={(e) => setStartupData({...startupData, probleme: e.target.value})}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-2">La Solution</h3>
                      <textarea 
                        className="w-full p-4 bg-slate-50 text-slate-900 rounded-2xl border border-slate-200 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={startupData.solution || ''}
                        onChange={(e) => setStartupData({...startupData, solution: e.target.value})}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-2">L'Équipe nécessaire</h3>
                      <textarea 
                        className="w-full p-4 bg-slate-50 text-slate-900 rounded-2xl border border-slate-200 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={startupData.equipe || ''}
                        onChange={(e) => setStartupData({...startupData, equipe: e.target.value})}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-8">
                    <div className="flex justify-end mb-4 gap-2">
                      <button onClick={handlePreviewStartupPdf} disabled={isExporting} className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors shadow-sm hidden sm:flex">
                        {isExporting && !startupPdfPreviewUrl ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />} Aperçu PDF
                      </button>
                      <button onClick={handleExportStartupPdf} disabled={isExporting} className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm border border-emerald-100">
                        {isExporting && !startupPdfPreviewUrl ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Exporter PDF
                      </button>
                    </div>

                    {/* Startup PDF Preview Modal */}
                    <AnimatePresence>
                      {startupPdfPreviewUrl && (
                        <motion.div 
                          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                          <motion.div 
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="bg-white rounded-[32px] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
                          >
                            <div className="flex justify-between items-center p-6 border-b border-slate-100">
                              <h3 className="text-xl font-black text-slate-900">Aperçu de la Startup</h3>
                              <button onClick={() => setStartupPdfPreviewUrl(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={24} className="text-slate-500" />
                              </button>
                            </div>
                            <div className="flex-1 bg-slate-100 p-2 sm:p-6">
                               <iframe src={startupPdfPreviewUrl} className="w-full h-full rounded-2xl shadow-sm bg-white" title="Startup Preview" />
                            </div>
                            <div className="p-6 border-t border-slate-100 flex justify-end gap-4 bg-white">
                              <button onClick={() => setStartupPdfPreviewUrl(null)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Fermer</button>
                              <button onClick={handleExportStartupPdf} disabled={isExporting} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                                 {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Confirmer l'export
                              </button>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div ref={startupRef}>
                      <div className="bg-slate-900 text-white rounded-3xl p-8 text-center space-y-8">
                      <h1 className="text-4xl font-black">{startupData.projet}</h1>
                      <p className="text-xl text-slate-300 max-w-2xl mx-auto">{startupData.pitch}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mt-12">
                        <div className="bg-white/10 p-6 rounded-2xl">
                          <h3 className="text-emerald-400 font-bold mb-2">Le Problème</h3>
                          <p className="text-slate-300">{startupData.probleme}</p>
                        </div>
                        <div className="bg-white/10 p-6 rounded-2xl">
                          <h3 className="text-blue-400 font-bold mb-2">Notre Solution</h3>
                          <p className="text-slate-300">{startupData.solution}</p>
                        </div>
                      </div>
                      <div className="bg-white/10 p-6 rounded-2xl text-left">
                        <h3 className="text-purple-400 font-bold mb-2">L'Équipe</h3>
                        <p className="text-slate-300">{startupData.equipe}</p>
                      </div>
                      <button className="px-8 py-4 bg-emerald-500 text-white font-black rounded-full hover:bg-emerald-600 transition-colors">
                        Rejoindre l'aventure
                      </button>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {activeSubModule === 'plan' && startupData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveSubModule(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <CheckSquare className="text-emerald-500" /> Plan d'Action
                </h2>
                <button onClick={() => setActiveSubModule(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
                {startupData.planAction?.map((task: any, index: number) => (
                  <div key={index} className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors cursor-pointer ${task.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`} onClick={() => toggleTask(index)}>
                    <input type="checkbox" checked={task.completed || false} readOnly className="mt-1 w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500" />
                    <div>
                      <h4 className={`font-bold ${task.completed ? 'text-emerald-900 line-through' : 'text-slate-900'}`}>{task.titre || task.title || `Tâche ${index + 1}`}</h4>
                      <p className={`text-sm ${task.completed ? 'text-emerald-600/70' : 'text-slate-500'}`}>{task.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {activeSubModule === 'defis' && startupData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveSubModule(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Target className="text-orange-500" /> Défis Quotidiens
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleGenerateDefis}
                    disabled={isGeneratingDefis}
                    className="px-4 py-2 bg-orange-50 text-orange-600 font-bold rounded-xl hover:bg-orange-100 flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
                  >
                    {isGeneratingDefis ? <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : <Rocket size={16} />}
                    Nouveaux défis
                  </button>
                  <button onClick={() => setActiveSubModule(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
                {startupData.defis?.map((defi: any, index: number) => {
                  const isCompleted = typeof defi === 'object' ? defi.completed : false;
                  const desc = typeof defi === 'string' ? defi : defi.description || defi.titre;
                  return (
                    <div key={index} onClick={() => toggleDefi(index)} className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-colors ${isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-orange-50 border-orange-100 text-orange-900'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>
                        {isCompleted ? <CheckSquare size={16} /> : index + 1}
                      </div>
                      <div>
                        <p className={`font-medium ${isCompleted ? 'line-through opacity-70' : ''}`}>{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {activeSubModule === 'marche' && startupData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveSubModule(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <BarChart2 className="text-purple-500" /> Analyse de Marché
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleDeepenMarche}
                    disabled={isGeneratingMarche}
                    className="px-4 py-2 bg-purple-50 text-purple-600 font-bold rounded-xl hover:bg-purple-100 flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
                  >
                    {isGeneratingMarche ? <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /> : <Rocket size={16} />}
                    Approfondir l'analyse
                  </button>
                  <button onClick={() => setActiveSubModule(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
                {startupData.marche && (
                  <>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-3 text-lg">Segments Clients</h3>
                      <ul className="list-disc pl-5 space-y-2 text-slate-600">
                        {startupData.marche.segments?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-3 text-lg">Concurrents</h3>
                      <ul className="list-disc pl-5 space-y-2 text-slate-600">
                        {startupData.marche.concurrents?.map((c: string, i: number) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-3 text-lg">Matrice SWOT</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl">
                          <h4 className="font-bold text-emerald-700 mb-2">Forces (Strengths)</h4>
                          <ul className="list-disc pl-5 text-sm text-emerald-600">
                            {startupData.marche.swot?.forces?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                        <div className="p-4 bg-red-50 rounded-2xl">
                          <h4 className="font-bold text-red-700 mb-2">Faiblesses (Weaknesses)</h4>
                          <ul className="list-disc pl-5 text-sm text-red-600">
                            {startupData.marche.swot?.faiblesses?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl">
                          <h4 className="font-bold text-blue-700 mb-2">Opportunités (Opportunities)</h4>
                          <ul className="list-disc pl-5 text-sm text-blue-600">
                            {startupData.marche.swot?.opportunites?.map((o: string, i: number) => <li key={i}>{o}</li>)}
                          </ul>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-2xl">
                          <h4 className="font-bold text-orange-700 mb-2">Menaces (Threats)</h4>
                          <ul className="list-disc pl-5 text-sm text-orange-600">
                            {startupData.marche.swot?.menaces?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
