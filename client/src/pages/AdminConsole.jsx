import React, { useState, useEffect, useRef } from 'react';
import { usePersona } from '../context/PersonaContext';
import { Plus, Edit2, Trash2, Upload, Download } from 'lucide-react';
import Modal from '../components/shared/Modal';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';

const ROLE_COLORS = { demand_planning: '#1B3A6B', branch_sales: '#2563EB', category_team: '#7C3AED', admin: '#DC2626' };
const ROLE_LABELS = { demand_planning: 'Demand Planner', branch_sales: 'Branch Manager', category_team: 'Category Mgr', admin: 'Admin' };
const BRANCHES = ['All','Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const ROLES = ['demand_planning','branch_sales','category_team','admin'];
const CATEGORIES = ['Refrigerator','Washing Machine','Air Conditioner','Microwave','Dishwasher'];

const EMPTY_PRODUCT = { sku: '', category: 'Refrigerator', segment: '', subsegment: '', price: '', star_rating: '4' };

function downloadCSV(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export default function AdminConsole() {
  useEffect(() => { document.title = 'WhirlCast — Admin Console'; }, []);
  const { toast } = useToast();
  const { persona, activeView, setActiveView } = usePersona();

  const [localTab, setLocalTab] = useState('products');
  useEffect(() => { setActiveView('products'); }, []);
  const activeTab    = persona ? activeView    : localTab;
  const setActiveTab = persona ? setActiveView : setLocalTab;
  const [products, setProducts] = useState([]);
  const [lfl, setLfl] = useState([]);
  const [users, setUsers] = useState([]);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);

  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showAddLfl, setShowAddLfl] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'demand_planning', branch_access: 'All' });
  const [newLfl, setNewLfl] = useState({ old_sku: '', new_sku: '', effective_date: '', reason: '' });

  const productCsvRef = useRef();
  const lflCsvRef = useRef();

  const refetchProducts = () => fetch('/api/admin/products').then(r => r.json()).then(d => setProducts(d.products || []));
  const refetchLfl     = () => fetch('/api/admin/lfl').then(r => r.json()).then(d => setLfl(d.mappings || []));
  const refetchUsers   = () => fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users || []));

  useEffect(() => { refetchProducts(); refetchLfl(); refetchUsers(); }, []);

  // ── Products ──────────────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!newProduct.sku || !newProduct.category) { toast.warning('SKU and Category are required'); return; }
    const res = await fetch('/api/admin/products/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProduct),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to add product'); return; }
    await refetchProducts();
    setShowAddProduct(false);
    setNewProduct(EMPTY_PRODUCT);
    toast.success('Product added');
  };

  const handleEditProduct = async () => {
    if (!editProduct.category) { toast.warning('Category is required'); return; }
    await fetch(`/api/admin/products/${editProduct.sku}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: editProduct.category, segment: editProduct.segment, subsegment: editProduct.subsegment, price: editProduct.price, star_rating: editProduct.star_rating }),
    });
    await refetchProducts();
    setEditProduct(null);
    toast.success('Product updated');
  };

  const handleDeleteProduct = async (sku) => {
    if (!window.confirm(`Deactivate ${sku}?`)) return;
    await fetch(`/api/admin/products/${sku}`, { method: 'DELETE' });
    await refetchProducts();
    toast.info(`${sku} deactivated`);
  };

  const handleToggleProduct = async (sku, currentActive) => {
    await fetch(`/api/admin/products/${sku}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: currentActive ? 0 : 1 }),
    });
    setProducts(prev => prev.map(p => p.sku === sku ? { ...p, active: currentActive ? 0 : 1 } : p));
  };

  const handleProductCsvUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    const res = await fetch('/api/admin/products/upload', { method: 'POST', body: form });
    const data = await res.json();
    await refetchProducts();
    toast.success(data.message || 'Uploaded');
    e.target.value = '';
  };

  const handleProductTemplate = () => {
    downloadCSV('product_master_template.csv',
      ['SKU','Category','Segment','Subsegment','Price','StarRating'],
      [['REF_240L_FrostFree','Refrigerator','Double Door','Frost Free','28000','4']]);
  };

  // ── LFL ───────────────────────────────────────────────────────
  const handleAddLfl = async () => {
    if (!newLfl.old_sku || !newLfl.new_sku) { toast.warning('Old SKU and New SKU are required'); return; }
    await fetch('/api/admin/lfl/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLfl) });
    await refetchLfl();
    setShowAddLfl(false);
    setNewLfl({ old_sku: '', new_sku: '', effective_date: '', reason: '' });
    toast.success('LFL mapping added');
  };

  const handleDeleteLfl = async (id) => {
    await fetch(`/api/admin/lfl/${id}`, { method: 'DELETE' });
    setLfl(prev => prev.filter(l => l.id !== id));
    toast.info('Mapping deleted');
  };

  const handleLflCsvUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    const res = await fetch('/api/admin/lfl/upload', { method: 'POST', body: form });
    const data = await res.json();
    await refetchLfl();
    toast.success(data.message || 'Uploaded');
    e.target.value = '';
  };

  const handleLflTemplate = () => {
    downloadCSV('lfl_master_template.csv',
      ['OldSKU','NewSKU','EffectiveDate','Reason'],
      [['REF_185L_DirectCool','REF_190L_DirectCool','2026-01-01','Model refresh']]);
  };

  // ── Users ─────────────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) { toast.warning('Name and Email are required'); return; }
    await fetch('/api/admin/users/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
    await refetchUsers();
    setShowAddUser(false);
    setNewUser({ name: '', email: '', role: 'demand_planning', branch_access: 'All' });
    toast.success('User added');
  };

  const handleEditUser = async () => {
    await fetch(`/api/admin/users/${editUser.user_id}/deactivate`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: editUser.active }),
    });
    await refetchUsers();
    setEditUser(null);
    toast.success('User updated');
  };

  const handleToggleUser = async (userId, currentActive) => {
    await fetch(`/api/admin/users/${userId}/deactivate`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: currentActive ? 0 : 1 }),
    });
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, active: currentActive ? 0 : 1 } : u));
  };

  const TABS = [
    { id: 'products', label: '📦 Product Master' },
    { id: 'lfl', label: '🔄 LFL Master' },
    { id: 'users', label: '👤 User Management' },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader title="Admin Console"
        subtitle="Manage product masters, LFL mapping and users"
        helpText="Manage product master data (SKUs, categories, pricing), configure like-for-like mappings for discontinued products, and control user access. Changes take effect immediately for all active sessions."/>

      {/* Tabs — only shown when not using sidebar navigation (non-persona auth flow) */}
      {!persona && (
        <div style={{ display: 'flex', gap: 4, background: '#F4F6FA', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? '#FFF' : 'transparent',
              color: activeTab === tab.id ? '#1B3A6B' : '#6B7280',
              border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', fontFamily: 'Inter', boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Product Master */}
      {activeTab === 'products' && (
        <div style={{ background: '#FFF', borderRadius: 12, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: 1 }}>Product Master ({products.length} SKUs)</h3>
            <input ref={productCsvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleProductCsvUpload} />
            <button onClick={handleProductTemplate} style={outlineBtn}><Download size={13} /> Template</button>
            <button onClick={() => productCsvRef.current?.click()} style={outlineBtn}><Upload size={13} /> Upload CSV</button>
            <button onClick={() => { setNewProduct(EMPTY_PRODUCT); setShowAddProduct(true); }} style={primaryBtn}><Plus size={13} /> Add SKU</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['SKU','Category','Segment','Subsegment','Price (₹)','Stars','Active','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.sku} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#FFF' : '#FAFAFA'}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#1B3A6B' }}>{p.sku}</td>
                    <td style={tdStyle}>{p.category}</td>
                    <td style={tdStyle}>{p.segment}</td>
                    <td style={tdStyle}>{p.subsegment}</td>
                    <td style={tdStyle}>₹{(p.price || 0).toLocaleString('en-IN')}</td>
                    <td style={tdStyle}>{'★'.repeat(p.star_rating || 0)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={() => handleToggleProduct(p.sku, p.active)} style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: p.active ? '#16A34A' : '#D1D5DB', position: 'relative', transition: 'background 0.2s',
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%', background: 'white',
                          position: 'absolute', top: 3, left: p.active ? 18 : 4, transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => setEditProduct({ ...p })} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                          <Edit2 size={11} color="#1B3A6B" />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.sku)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                          <Trash2 size={11} color="#DC2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LFL Master */}
      {activeTab === 'lfl' && (
        <div style={{ background: '#FFF', borderRadius: 12, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Like-for-Like Product Mapping</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={lflCsvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleLflCsvUpload} />
                <button onClick={handleLflTemplate} style={outlineBtn}><Download size={13} /> Template</button>
                <button onClick={() => lflCsvRef.current?.click()} style={outlineBtn}><Upload size={13} /> Upload CSV</button>
                <button onClick={() => setShowAddLfl(true)} style={primaryBtn}><Plus size={13} /> Add Mapping</button>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Map discontinued SKUs to their successor products for accurate forecast comparison</p>
          </div>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['Old SKU','→','New SKU','Effective Date','Reason','Added By','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {lfl.length === 0 && (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>No LFL mappings — click Add Mapping to create one.</td></tr>
                )}
                {lfl.map((m, i) => (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                    <td style={{ ...tdStyle, color: '#DC2626', fontWeight: 500 }}>{m.old_sku}</td>
                    <td style={{ ...tdStyle, fontSize: 16, color: '#9CA3AF' }}>→</td>
                    <td style={{ ...tdStyle, color: '#16A34A', fontWeight: 500 }}>{m.new_sku}</td>
                    <td style={tdStyle}>{m.effective_date}</td>
                    <td style={{ ...tdStyle, color: '#6B7280', maxWidth: 140 }}>{m.reason}</td>
                    <td style={tdStyle}>{m.added_by}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={() => handleDeleteLfl(m.id)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                        <Trash2 size={11} color="#DC2626" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Management */}
      {activeTab === 'users' && (
        <div style={{ background: '#FFF', borderRadius: 12, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>User Management ({users.length} users)</h3>
            <button onClick={() => setShowAddUser(true)} style={primaryBtn}><Plus size={13} /> Add User</button>
          </div>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['Name','Email','Role','Branch Access','Last Login','Status','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.user_id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{u.name}</td>
                    <td style={{ ...tdStyle, color: '#6B7280' }}>{u.email}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: `${ROLE_COLORS[u.role]}15`, color: ROLE_COLORS[u.role],
                        borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                      }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td style={tdStyle}>{u.branch_access}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: '#9CA3AF' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        background: u.active ? '#F0FDF4' : '#F9FAFB', color: u.active ? '#16A34A' : '#9CA3AF',
                        borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                      }}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => setEditUser({ ...u })} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                          <Edit2 size={11} color="#1B3A6B" />
                        </button>
                        <button onClick={() => handleToggleUser(u.user_id, u.active)} style={{ background: u.active ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${u.active ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 10, fontFamily: 'Inter', color: u.active ? '#DC2626' : '#16A34A' }}>
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <Modal isOpen={showAddProduct} onClose={() => setShowAddProduct(false)} title="Add New SKU">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>SKU Code *</label><input value={newProduct.sku} onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. REF_240L_FrostFree" style={inputStyle} /></div>
          <div><label style={labelStyle}>Category *</label>
            <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Segment</label><input value={newProduct.segment} onChange={e => setNewProduct(p => ({ ...p, segment: e.target.value }))} placeholder="e.g. Double Door" style={inputStyle} /></div>
            <div><label style={labelStyle}>Subsegment</label><input value={newProduct.subsegment} onChange={e => setNewProduct(p => ({ ...p, subsegment: e.target.value }))} placeholder="e.g. Frost Free" style={inputStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Price (₹)</label><input type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="28000" style={inputStyle} /></div>
            <div><label style={labelStyle}>Star Rating</label>
              <select value={newProduct.star_rating} onChange={e => setNewProduct(p => ({ ...p, star_rating: e.target.value }))} style={selectStyle}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setShowAddProduct(false)} style={cancelBtn}>Cancel</button>
            <button onClick={handleAddProduct} style={confirmBtn}>Add SKU</button>
          </div>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title={`Edit — ${editProduct?.sku}`}>
        {editProduct && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Category</label>
              <select value={editProduct.category} onChange={e => setEditProduct(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Segment</label><input value={editProduct.segment || ''} onChange={e => setEditProduct(p => ({ ...p, segment: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Subsegment</label><input value={editProduct.subsegment || ''} onChange={e => setEditProduct(p => ({ ...p, subsegment: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Price (₹)</label><input type="number" value={editProduct.price || ''} onChange={e => setEditProduct(p => ({ ...p, price: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Star Rating</label>
                <select value={editProduct.star_rating || 3} onChange={e => setEditProduct(p => ({ ...p, star_rating: parseInt(e.target.value) }))} style={selectStyle}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setEditProduct(null)} style={cancelBtn}>Cancel</button>
              <button onClick={handleEditProduct} style={confirmBtn}>Save Changes</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Add New User">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Name *</label><input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Email *</label><input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Role</label>
            <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} style={selectStyle}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Branch Access</label>
            <select value={newUser.branch_access} onChange={e => setNewUser(p => ({ ...p, branch_access: e.target.value }))} style={selectStyle}>
              {BRANCHES.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setShowAddUser(false)} style={cancelBtn}>Cancel</button>
            <button onClick={handleAddUser} style={confirmBtn}>Add User</button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Edit User — ${editUser?.name}`}>
        {editUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '10px 12px', background: '#F8FAFF', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B' }}>{editUser.name}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{editUser.email}</div>
            </div>
            <div><label style={labelStyle}>Status</label>
              <select value={editUser.active} onChange={e => setEditUser(p => ({ ...p, active: parseInt(e.target.value) }))} style={selectStyle}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setEditUser(null)} style={cancelBtn}>Cancel</button>
              <button onClick={handleEditUser} style={confirmBtn}>Save Changes</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add LFL Modal */}
      <Modal isOpen={showAddLfl} onClose={() => setShowAddLfl(false)} title="Add LFL Mapping">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Old SKU *</label><input value={newLfl.old_sku} onChange={e => setNewLfl(p => ({ ...p, old_sku: e.target.value }))} placeholder="e.g. REF_185L_DirectCool" style={inputStyle} /></div>
          <div><label style={labelStyle}>New SKU *</label><input value={newLfl.new_sku} onChange={e => setNewLfl(p => ({ ...p, new_sku: e.target.value }))} placeholder="e.g. REF_190L_DirectCool" style={inputStyle} /></div>
          <div><label style={labelStyle}>Effective Date</label><input type="date" value={newLfl.effective_date} onChange={e => setNewLfl(p => ({ ...p, effective_date: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Reason</label><textarea value={newLfl.reason} onChange={e => setNewLfl(p => ({ ...p, reason: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowAddLfl(false)} style={cancelBtn}>Cancel</button>
            <button onClick={handleAddLfl} style={confirmBtn}>Add Mapping</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280', background: '#F8FAFF', textAlign: 'left', border: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const tdStyle = { padding: '9px 12px', fontSize: 12, color: '#1A1A2E', border: '1px solid #F0F0F0' };
const labelStyle = { fontSize: 11, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 };
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'Inter', outline: 'none', color: '#1A1A2E', boxSizing: 'border-box' };
const selectStyle = { width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'Inter', outline: 'none', background: '#FFF', color: '#1A1A2E' };
const primaryBtn = { background: 'var(--navy-accent)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 };
const outlineBtn = { background: '#F4F6FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1A1A2E' };
const cancelBtn = { flex: 1, background: '#F4F6FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 };
const confirmBtn = { flex: 2, background: 'var(--navy-accent)', color: 'white', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600, fontSize: 13 };
