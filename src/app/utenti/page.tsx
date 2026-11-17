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
  canCreateApiKeys?: boolean;
  createdAt: string;
}

export default function UtentiPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<'admin' | 'operatore' | null>(null);
  const isAdmin = actorRole === 'admin';
  const [newCanCreateKeys, setNewCanCreateKeys] = useState(false);
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
        setActorRole(data.actor?.role || null);
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
          role: newRole,
          canCreateApiKeys: newRole === 'admin' || newCanCreateKeys
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
      setNewCanCreateKeys(false);
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

  const handleToggleApiKeys = async (user: PublicUser) => {
    setError('');
    const next = !user.canCreateApiKeys;
    setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, canCreateApiKeys: next } : u)));
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, canCreateApiKeys: next })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Impossibile aggiornare il permesso');
        fetchUsers();
        return;
      }
      setSuccess(next
        ? `${user.displayName} ora può creare chiavi API`
        : `${user.displayName} non può più creare chiavi API: le sue chiavi sono sospese`);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Errore di connessione');
      fetchUsers();
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
    <div className="flex-1 flex flex-col min-h-0 bg-sunken text-ink p-2 sm:p-4 font-sans relative">
      <div className="max-w-5xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent-ink" />
              Gestione Utenti & Team
            </h1>
            <p className="text-ink-muted text-xs">Crea e gestisci gli account operatori per l&apos;accesso al laboratorio</p>
          </div>

          {isAdmin && <button
            onClick={() => setAddModalOpen(true)}
            className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-on-accent font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md "
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Aggiungi Nuovo Utente</span>
          </button>}
        </div>

        {/* Notifiche */}
        {error && (
          <div className="p-3 bg-danger-soft border border-danger-line rounded-xl text-danger-ink text-xs flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-accent-soft border border-accent-line rounded-xl text-accent-ink text-xs flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Tabella Utenti */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-lg flex-1 min-h-0 flex flex-col">
          <div className="p-3 sm:p-4 border-b border-line flex justify-between items-center flex-shrink-0">
            <h2 className="text-xs sm:text-sm font-bold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-ink" /> Elenco Account ({users.length})
            </h2>
            <span className="text-[11px] text-ink-faint">Credenziali conservate in modo sicuro su disco</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-ink-faint text-xs flex-1 flex items-center justify-center">Caricamento utenti in corso...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-ink-faint text-xs flex-1 flex items-center justify-center">Nessun utente registrato.</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-line">
              {users.map((u) => {
                const isSelf = currentUserId === u.id;
                return (
                  <div key={u.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-raised transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-raised border border-line-strong flex items-center justify-center font-bold text-ink text-sm">
                        {u.displayName.slice(0, 2) || u.username.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink text-sm">{u.displayName}</span>
                          <span className="text-xs text-ink-muted font-mono">(@{u.username})</span>
                          {isSelf && (
                            <span className="bg-accent-soft text-accent-ink border border-accent-line px-2 py-0.5 rounded text-[10px] font-medium">
                              Tu
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-faint mt-0.5">
                          Registrato il {new Date(u.createdAt).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-ink-faint px-2" title="Gli amministratori possono sempre creare chiavi API">Chiavi API sempre</span>
                      ) : (
                        <label className={`flex items-center gap-2 rounded-lg border border-line px-2.5 min-h-9 text-xs ${isAdmin ? 'cursor-pointer hover:bg-raised' : 'opacity-70'}`}
                          title={isAdmin ? 'Consenti a questo utente di creare e gestire le proprie chiavi API' : 'Solo un amministratore può cambiare questo permesso'}>
                          <span className="text-ink-muted">Chiavi API</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={Boolean(u.canCreateApiKeys)}
                            aria-label={`Chiavi API per ${u.displayName}`}
                            disabled={!isAdmin}
                            onClick={() => handleToggleApiKeys(u)}
                            className={`relative h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed ${u.canCreateApiKeys ? 'bg-accent' : 'bg-muted'}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${u.canCreateApiKeys ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </label>
                      )}
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        u.role === 'admin' 
                          ? 'bg-info-soft border-info-line text-info-ink' 
                          : 'bg-info-soft border-info-line text-info-ink'
                      }`}>
                        {u.role === 'admin' ? 'Amministratore' : 'Operatore'}
                      </span>

                      {/* Tasto Modifica Password */}
                      {(isAdmin || isSelf) && <button
                        onClick={() => {
                          setTargetUser(u);
                          setPwdModalOpen(true);
                        }}
                        className="p-2 bg-raised hover:bg-muted text-ink-muted rounded-lg transition-colors"
                        title="Cambia password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>}

                      {/* Tasto Elimina Utente */}
                      {isAdmin && !isSelf && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 bg-raised hover:bg-danger-soft text-ink-muted hover:text-danger-ink rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-scrim z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-xl w-full max-w-md p-6 shadow-lg space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-bold text-ink text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-accent-ink" /> Nuovo Utente
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-ink-muted hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Username (login)</label>
                <input 
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Es. mario"
                  className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Nome Visualizzato</label>
                <input 
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Password</label>
                <input 
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimo 4 caratteri"
                  className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Ruolo</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'admin' | 'operatore')}
                  className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                >
                  <option value="operatore">Operatore (Uso standard)</option>
                  <option value="admin">Amministratore (Gestione team)</option>
                </select>
              </div>

              {newRole === 'operatore' && (
                <label className="flex items-start gap-2.5 text-sm text-ink-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCanCreateKeys}
                    onChange={e => setNewCanCreateKeys(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <span>Può creare chiavi API <span className="block text-xs text-ink-faint">Per collegare assistenti AI e automazioni con i permessi del suo ruolo.</span></span>
                </label>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-raised text-ink-muted text-xs font-medium rounded-xl hover:bg-muted"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent text-on-accent text-xs font-bold rounded-xl hover:bg-accent-hover shadow-md "
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
        <div className="fixed inset-0 bg-scrim z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-xl w-full max-w-md p-6 shadow-lg space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-bold text-ink text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-accent-ink" /> Cambia Password per {targetUser.displayName}
              </h3>
              <button onClick={() => setPwdModalOpen(false)} className="text-ink-muted hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Nuova Password</label>
                <input 
                  type="password"
                  required
                  minLength={4}
                  autoFocus
                  value={newPasswordValue}
                  onChange={e => setNewPasswordValue(e.target.value)}
                  placeholder="Minimo 4 caratteri"
                  className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 bg-raised text-ink-muted text-xs font-medium rounded-xl hover:bg-muted"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent text-on-accent text-xs font-bold rounded-xl hover:bg-accent-hover shadow-md "
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
