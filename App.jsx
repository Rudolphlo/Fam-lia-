import React, { useState, useEffect } from 'react';
import { 
  Home, CheckSquare, GraduationCap, Calendar as CalendarIcon, 
  Settings, Plus, Trash2, Copy, LogOut, Check, Clock, 
  ShoppingBag, XCircle, ChevronLeft, Trash 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, getDoc, writeBatch } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'familia-original-v1';

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const v = {
    primary: "bg-indigo-600 text-white shadow-md",
    secondary: "bg-white text-indigo-600 border border-indigo-100",
    danger: "bg-red-50 text-red-600",
    ghost: "bg-transparent text-gray-400"
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${v[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="mb-4 w-full text-left">
    {label && <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">{label}</label>}
    <input {...props} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-gray-800" />
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [familyData, setFamilyData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newItem, setNewItem] = useState({ type: 'routine', title: '', details: '', date: '' });

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    return onSnapshot(profileRef, (snap) => {
      if (snap.exists() && snap.data().familyId) {
        const fId = snap.data().familyId;
        onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'families', fId), (fSnap) => {
          if (fSnap.exists()) setFamilyData({ id: fSnap.id, ...fSnap.data() });
        });
        onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'family_items'), (snapshot) => {
          const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.familyId === fId);
          setItems(all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
          setLoading(false);
        });
      } else { setLoading(false); }
    });
  }, [user]);

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code), { name: familyName, members: [user.uid], createdAt: serverTimestamp() });
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { familyId: code });
  };

  const handleJoinFamily = async () => {
    const code = joinCode.trim().toUpperCase();
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code));
    if (snap.exists()) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code), { members: [...(snap.data().members || []), user.uid] });
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { familyId: code });
    }
  };

  const handleAddItem = async () => {
    if (!newItem.title.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'family_items'), { ...newItem, familyId: familyData.id, completed: false, createdAt: serverTimestamp(), createdBy: user.uid });
    setShowAddModal(false);
    setNewItem({ ...newItem, title: '', details: '', date: '' });
  };

  const clearCompletedShopping = async () => {
    const batch = writeBatch(db);
    items.filter(i => i.type === 'shopping' && i.completed).forEach(item => {
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'family_items', item.id));
    });
    await batch.commit();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!familyData) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6"><Home className="w-10 h-10 text-indigo-600" /></div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">Gestão Familiar</h1>
      <div className="w-full max-w-xs space-y-4">
        {isCreating ? (
          <>
            <Input label="Nome da Família" value={familyName} onChange={e => setFamilyName(e.target.value)} />
            <Button onClick={handleCreateFamily} className="w-full">Criar Grupo</Button>
            <button onClick={() => setIsCreating(false)} className="text-[10px] font-black text-gray-400 uppercase">Voltar</button>
          </>
        ) : (
          <>
            <Input label="Código de Convite" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} />
            <Button onClick={handleJoinFamily} className="w-full">Entrar</Button>
            <Button variant="secondary" onClick={() => setIsCreating(true)} className="w-full">Nova Família</Button>
          </>
        )}
      </div>
    </div>
  );

  const filteredItems = activeTab === 'dashboard' ? items.slice(0, 5) : items.filter(i => i.type === (activeTab === 'calendar' ? 'event' : activeTab));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col max-w-md mx-auto relative shadow-2xl font-sans">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white sticky top-0 z-30 shadow-sm">
        <div className="text-left">
          <h2 className="text-xl font-black text-gray-900">{familyData.name}</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{familyData.members?.length || 1} Membros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="p-2.5 bg-gray-50 rounded-xl text-gray-400"><Settings className="w-5 h-5" /></button>
          <button onClick={() => { setNewItem({...newItem, type: activeTab === 'dashboard' ? 'routine' : (activeTab === 'calendar' ? 'event' : activeTab)}); setShowAddModal(true); }} className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg"><Plus className="w-6 h-6" /></button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-28 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-end px-2 mb-4">
          <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{activeTab}</h3>
          {activeTab === 'shopping' && items.some(i => i.type === 'shopping' && i.completed) && (
            <button onClick={clearCompletedShopping} className="text-[10px] font-black text-red-400 uppercase flex items-center gap-1"><Trash className="w-3 h-3" /> Limpar</button>
          )}
        </div>
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div key={item.id} className={`bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 ${item.completed ? 'opacity-40' : ''}`}>
              <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'family_items', item.id), { completed: !item.completed })} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${item.completed ? 'bg-indigo-600 border-indigo-600' : 'border-gray-100'}`}>
                {item.completed && <Check className="w-4 h-4 text-white" />}
              </button>
              <div className="flex-1 text-left">
                <p className={`text-sm font-bold ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.title}</p>
                {item.date && <p className="text-[9px] font-bold text-indigo-400 uppercase">{new Date(item.date).toLocaleDateString('pt-PT')}</p>}
              </div>
              <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'family_items', item.id))} className="text-gray-200"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-50 px-4 pt-3 pb-8 flex justify-around items-center z-40">
        {[{ id: 'dashboard', icon: Home, label: 'Início' }, { id: 'routine', icon: CheckSquare, label: 'Rotina' }, { id: 'shopping', icon: ShoppingBag, label: 'Compras' }, { id: 'education', icon: GraduationCap, label: 'Escola' }, { id: 'calendar', icon: CalendarIcon, label: 'Agenda' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center gap-1.5 p-2 ${activeTab === t.id ? 'text-indigo-600' : 'text-gray-300'}`}>
            <t.icon className="w-5 h-5" /><span className="text-[9px] font-bold uppercase tracking-tighter">{t.label}</span>
          </button>
        ))}
      </nav>

      {showAddModal && (
        <div className="absolute inset-0 z-[100] bg-black/40 flex items-end p-4">
          <div className="bg-white w-full rounded-3xl p-6 pb-10 shadow-2xl">
            <h3 className="text-lg font-black mb-6 text-gray-900 text-left">Novo Registro</h3>
            <Input label="Título" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="O que adicionar?" />
            {(newItem.type === 'event' || newItem.type === 'education') && <Input type="date" label="Data" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />}
            <div className="flex gap-3 mt-4">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleAddItem} className="flex-1" disabled={!newItem.title.trim()}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-[110] bg-white p-6">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setShowSettings(false)} className="p-2 bg-gray-50 rounded-xl text-gray-400"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-xl font-black text-gray-900">Ajustes</h2>
          </div>
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center mb-8">
            <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">Código da Família</p>
            <div className="flex items-center justify-between bg-white/50 p-4 rounded-2xl">
              <span className="text-2xl font-black text-indigo-700 tracking-[0.2em]">{familyData.id}</span>
              <button onClick={() => { navigator.clipboard.writeText(familyData.id); alert("Copiado!"); }} className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm"><Copy className="w-5 h-5" /></button>
            </div>
          </div>
          <Button variant="danger" onClick={async () => { if(confirm("Sair do grupo?")) { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { familyId: null }); window.location.reload(); } }} className="w-full"><LogOut className="w-5 h-5" /> Sair da Família</Button>
        </div>
      )}
    </div>
  );
}

