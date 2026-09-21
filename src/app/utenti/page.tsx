'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Trash2, KeyRound, Shield, 
  CheckCircle2, AlertCircle, ShieldAlert, X, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'operatore';
  createdAt: string;
}

export default function UtentiPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modale Nuovo Utente
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operatore'>('operatore');

  // Modale Cambio Password
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<PublicUser | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      setError('Errore durante il recupero degli utenti');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.user?.id || null);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          displayName: newDisplayName,
          password: newPassword,
          role: newRole
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante la creazione dell\'utente');
        return;
      }

      setSuccess(`Utente "${newUsername}" creato con successo!`);
      setAddModalOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Errore di connessione');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser.id,
          newPassword: newPasswordValue
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante l\'aggiornamento della password');
        return;
      }

      setSuccess(`Password di "${targetUser.displayName}" aggiornata con successo!`);
      setPwdModalOpen(false);
      setTargetUser(null);
      setNewPasswordValue('');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Errore di connessione');
    }
  };

  const handleDeleteUser = async (user: PublicUser) => {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${user.displayName}" (${user.username})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante l\'eliminazione');
        return;
      }

      setSuccess(`Utente "${user.displayName}" eliminato con successo`);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Errore di connessione');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-200 p-2 sm:p-4 font-sans relative">
      <div className="max-w-5xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Gestione Utenti & Team
            </h1>
            <p className="text-slate-400 text-xs">Crea e gestisci gli account operatori per l&apos;accesso al laboratorio</p>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Aggiungi Nuovo Utente</span>
          </button>
        </div>

        {/* Notifiche */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Tabella Utenti */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-0 flex flex-col">
          <div className="p-3 sm:p-4 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Elenco Account ({users.length})
            </h2>
            <span className="text-[11px] text-slate-500">Credenziali conservate in modo sicuro su disco</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex-1 flex items-center justify-center">Caricamento utenti in corso...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex-1 flex items-center justify-center">Nessun utente registrato.</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/80">
              {users.map((u) => {
                const isSelf = currentUserId === u.id;
                return (
                  <div key={u.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-white uppercase text-sm">
                        {u.displayName.slice(0, 2) || u.username.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{u.displayName}</span>
                          <span className="text-xs text-slate-400 font-mono">(@{u.username})</span>
                          {isSelf && (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-medium">
                              Tu
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Registrato il {new Date(u.createdAt).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        u.role === 'admin' 
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      }`}>
                        {u.role === 'admin' ? '🛡️ Amministratore' : '🔧 Operatore'}
                      </span>

                      {/* Tasto Modifica Password */}
                      <button
                        onClick={() => {
                          setTargetUser(u);
                          setPwdModalOpen(true);
                        }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        title="Cambia password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      {/* Tasto Elimina Utente */}
                      {!isSelf && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                          title="Elimina account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* MODALE AGGIUNGI UTENTE */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" /> Nuovo Utente
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Username (login)</label>
                <input 
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Es. mario"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome Visualizzato</label>
                <input 
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Password</label>
                <input 
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimo 4 caratteri"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Ruolo</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'admin' | 'operatore')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="operatore">Operatore (Uso standard)</option>
                  <option value="admin">Amministratore (Gestione team)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-950"
                >
                  Crea Utente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CAMBIO PASSWORD */}
      {pwdModalOpen && targetUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" /> Cambia Password per {targetUser.displayName}
              </h3>
              <button onClick={() => setPwdModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nuova Password</label>
                <input 
                  type="password"
                  required
                  minLength={4}
                  autoFocus
                  value={newPasswordValue}
                  onChange={e => setNewPasswordValue(e.target.value)}
                  placeholder="Minimo 4 caratteri"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-950"
                >
                  Aggiorna Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
