import React, { useState, useEffect } from 'react';
import { 
  Home, CheckSquare, GraduationCap, Calendar as CalendarIcon, 
  Settings, Plus, Trash2, Copy, LogOut, Check, Clock, 
  ShoppingBag, XCircle, ChevronLeft, Trash 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, getDoc, writeBatch } from 'firebase/firestore';

// Configuração do Firebase (providenciada pelo ambiente)
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'familia-original-v1';

// Componente de Botão Estilizado
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

// Componente de Input Estilizado
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

  // Autenticação Inicial
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Monitorização de Dados da Família e Itens
  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists() && snap.data().familyId) {
        const fId = snap.data().familyId;
        
        // Dados da Família
        onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'families', fId), (fSnap) => {
          if (fSnap.exists()) setFamilyData({ id: fSnap.id, ...fSnap.data() });
        });

        // Itens da Família
        const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'family_items');
        onSnapshot(itemsRef, (snapshot) => {
          const all = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(i => i.familyId === fId);
          setItems(all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
          setLoading(false);
        }, (err) => console.error(err));
      } else {
        setLoading(false);
      }
    });

    return () => unsubProfile();
  }, [user]);

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code), { 
      name: familyName, 
      members: [user.uid], 
      createdAt: serverTimestamp() 
    });
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { familyId: code });
  };

  const handleJoinFamily = async () => {
    const code = joinCode.trim().toUpperCase();
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code));
    if (snap.exists()) {
      const data = snap.data();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code), { 
        members: [...(data.members || []), user.uid] 
      });
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { familyId: code });
    }
  };

  const handleAddItem = async () => {
    if (!newItem.title.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'family_items'), { 
      ...newItem, 
      familyId: familyData.id, 
      completed: false, 
      createdAt: serverTimestamp(), 
      createdBy: user.uid 
    });
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
      <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Gestão Familiar</h1>
      <p className="text-gray-400 text-sm mb-8">Organiza a tua casa num só lugar.</p>
      <div className="w-full max-w-xs space-y-4">
        {isCreating ? (
          <>
            <Input label="Nome da Família" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Ex: Família Silva" />
            <Button onClick={handleCreateFamily} className="w-full">Criar Grupo</Button>
            <button onClick={() => setIsCreating(false)} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Voltar</button>
          </>
        ) : (
          <>
            <Input label="Código de Convite" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} placeholder="ABC123" />
            <Button onClick={handleJoinFamily} className="w-full">Entrar no Grupo</Button>
            <div className="py-2 text-[10px] font-black text-gray-200 uppercase tracking-widest">Ou</div>
            <Button variant="secondary" onClick={() => setIsCreating(true)} className="w-full">Criar Nova Família</Button>
          </>
        )}
      </div>
    </div>
  );

  const filteredItems = activeTab === 'dashboard' ? items.slice(0, 5) : items.filter(i => i.type === (activeTab === 'calendar' ? 'event' : activeTab));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col max-w-md mx-auto relative shadow-2xl font-sans overflow-hidden">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white sticky top-0 z-30 shadow-sm">
        <div className="text-left">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">{familyData.name}</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{familyData.members?.length || 1} Membros Ativos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="p-2.5 bg-gray-50 rounded-xl text-gray-400 active:bg-gray-100 transition-colors"><Settings className="w-5 h-5" /></button>
          <button onClick={() => { setNewItem({...newItem, type: activeTab === 'dashboard' ? 'routine' : (activeTab === 'calendar' ? 'event' : activeTab)}); setShowAddModal(true); }} className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg active:scale-90 transition-transform"><Plus className="w-6 h-6" /></button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pt-6 pb-28 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-end px-2 mb-4">
          <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{activeTab === 'dashboard' ? 'Resumo Recente' : activeTab}</h3>
          {activeTab === 'shopping' && items.some(i => i.type === 'shopping' && i.completed) && (
            <button onClick={clearCompletedShopping} className="text-[10px] font-black text-red-400 uppercase flex items-center gap-1 active:text-red-600"><Trash className="w-3 h-3" /> Limpar Concluídos</button>
          )}
        </div>

        <div className="space-y-3">
          {filteredItems.map(item => (
            <div key={item.id} className={`bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 transition-all ${item.completed ? 'opacity-40 grayscale-[0.5]' : 'shadow-sm'}`}>
              <button 
                onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'family_items', item.id), { completed: !item.completed })} 
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${item.completed ? 'bg-indigo-600 border-indigo-600' : 'border-gray-100'}`}
              >
                {item.completed && <Check className="w-4 h-4 text-white" />}
              </button>
              <div className="flex-1 text-left">
                <p className={`text-sm font-bold leading-tight ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.title}</p>
                {item.date && <p className="text-[9px] font-black text-indigo-400 uppercase mt-0.5">{new Date(item.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</p>}
              </div>
              <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'family_items', item.id))} className="text-gray-200 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center opacity-20">
              <CheckSquare className="w-12 h-12 mb-2" />
              <p className="font-black text-[10px] uppercase tracking-widest">Tudo em dia!</p>
            </div>
          )}
        </div>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-md border-t border-gray-100 px-2 pt-3 pb-8 flex justify-around items-center z-40">
        {[
          { id: 'dashboard', icon: Home, label: 'Início' },
          { id: 'routine', icon: CheckSquare, label: 'Rotina' },
          { id: 'shopping', icon: ShoppingBag, label: 'Compras' },
          { id: 'education', icon: GraduationCap, label: 'Escola' },
          { id: 'calendar', icon: CalendarIcon, label: 'Agenda' }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center gap-1.5 p-2 transition-all ${activeTab === t.id ? 'text-indigo-600 scale-110' : 'text-gray-300'}`}>
            <t.icon className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-tighter">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Add Modal */}
      {showAddModal && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in duration-300">
          <div className="bg-white w-full rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
            <h3 className="text-xl font-black mb-6 text-gray-900 text-left tracking-tight">Adicionar Item</h3>
            
            <div className="flex gap-2 overflow-x-auto pb-6 mb-2 no-scrollbar">
              {[
                {id: 'routine', label: 'Rotina'},
                {id: 'shopping', label: 'Compras'},
                {id: 'education', label: 'Escola'},
                {id: 'event', label: 'Agenda'}
              ].map(t => (
                <button key={t.id} onClick={() => setNewItem({...newItem, type: t.id})} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all ${newItem.type === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>{t.label}</button>
              ))}
            </div>

            <Input label="O que pretendes adicionar?" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="Escreve aqui..." autoFocus />
            {(newItem.type === 'event' || newItem.type === 'education') && <Input type="date" label="Data Limite" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />}
            
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleAddItem} className="flex-1" disabled={!newItem.title.trim()}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Screen */}
      {showSettings && (
        <div className="absolute inset-0 z-[110] bg-white p-6 animate-in slide-in-from-right duration-300">
          <div className="flex items-center gap-4 mb-10 pt-6">
            <button onClick={() => setShowSettings(false)} className="p-2.5 bg-gray-50 rounded-2xl text-gray-400 active:bg-gray-100"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Configurações</h2>
          </div>
          
          <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 text-center mb-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100/50 rounded-full blur-3xl" />
            <p className="text-[10px] font-black text-indigo-400 uppercase mb-3 tracking-widest">Código de Acesso</p>
            <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm">
              <span className="text-2xl font-black text-indigo-700 tracking-[0.25em] ml-2">{familyData.id}</span>
              <button onClick={() => { navigator.clipboard.writeText(familyData.id); }} className="p-3 bg-indigo-50 rounded-xl text-indigo-600 active:bg-indigo-600 active:text-white transition-all"><Copy className="w-5 h-5" /></button>
            </div>
            <p className="mt-4 text-[9px] text-indigo-300 font-bold px-4">Partilha este código com os outros membros da família.</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-50">
             <Button variant="danger" onClick={async () => { if(confirm("Tens a certeza que queres sair desta família?")) { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { familyId: null }); window.location.reload(); } }} className="w-full py-4"><LogOut className="w-5 h-5" /> Sair do Grupo Familiar</Button>
          </div>
        </div>
      )}
    </div>
  );
}


