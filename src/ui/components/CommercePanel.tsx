import { useState, useMemo } from 'react';
import { useStore } from '../../data/store';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '../../data/types';
import type { Commerce, CommerceCategory } from '../../data/types';
import { v4 as uuidv4 } from 'uuid';
import { housesPerBlock } from '../../houseNumbering';

export function CommercePanel() {
  const {
    commerces, searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter,
    setDestinationCommerce, setDestination,
    addCommerce, updateCommerce, deleteCommerce,
    selectedCommerce, setSelectedCommerce,
    setActivePanel,
  } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Commerce>>({});

  const categories = Object.keys(CATEGORY_LABELS) as CommerceCategory[];

  const filtered = useMemo(() => {
    return commerces.filter(c => {
      const matchesSearch = !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = !categoryFilter || c.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [commerces, searchQuery, categoryFilter]);

  const handleNavigateTo = (commerce: Commerce) => {
    setDestinationCommerce(commerce.id);
    setDestination(commerce.blockId, commerce.houseNumber ?? null);
    setActivePanel('nav');
  };

  const handleEdit = (commerce: Commerce) => {
    setEditForm({ ...commerce });
    setIsEditing(true);
  };

  const handleNewCommerce = () => {
    setEditForm({
      id: uuidv4(),
      name: '',
      category: 'otro',
      blockId: '',
      schedule: '',
      whatsapp: '',
      description: '',
      tags: [],
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editForm.name || !editForm.blockId) return;

    const commerce: Commerce = {
      id: editForm.id || uuidv4(),
      name: editForm.name || '',
      category: (editForm.category as CommerceCategory) || 'otro',
      blockId: editForm.blockId || '',
      houseNumber: editForm.houseNumber,
      schedule: editForm.schedule || '',
      whatsapp: editForm.whatsapp || '',
      description: editForm.description || '',
      tags: editForm.tags || [],
    };

    if (commerces.find(c => c.id === commerce.id)) {
      updateCommerce(commerce.id, commerce);
    } else {
      addCommerce(commerce);
    }
    setIsEditing(false);
    setEditForm({});
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminar este comercio?')) {
      deleteCommerce(id);
      if (selectedCommerce?.id === id) setSelectedCommerce(null);
    }
  };

  if (isEditing) {
    return (
      <div className="panel commerce-panel">
        <h2>{editForm.id && commerces.find(c => c.id === editForm.id) ? 'Editar' : 'Nuevo'} Comercio</h2>

        <div className="field">
          <label>Nombre:</label>
          <input
            value={editForm.name || ''}
            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Nombre del comercio"
          />
        </div>

        <div className="field">
          <label>Categoria:</label>
          <select
            value={editForm.category || 'otro'}
            onChange={e => setEditForm({ ...editForm, category: e.target.value as CommerceCategory })}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Manzana:</label>
            <input
              value={editForm.blockId || ''}
              onChange={e => setEditForm({ ...editForm, blockId: e.target.value })}
              placeholder="Ej: 44"
            />
          </div>
          <div className="field">
            <label>Casa:</label>
            <input
              type="number"
              value={editForm.houseNumber || ''}
              onChange={e => setEditForm({ ...editForm, houseNumber: parseInt(e.target.value) || undefined })}
              placeholder="Ej: 5"
              max={editForm.blockId ? housesPerBlock[editForm.blockId] : undefined}
            />
          </div>
        </div>

        <div className="field">
          <label>Horario:</label>
          <input
            value={editForm.schedule || ''}
            onChange={e => setEditForm({ ...editForm, schedule: e.target.value })}
            placeholder="Lun-Vie 9:00-18:00"
          />
        </div>

        <div className="field">
          <label>WhatsApp:</label>
          <input
            value={editForm.whatsapp || ''}
            onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })}
            placeholder="+5491112345678"
          />
        </div>

        <div className="field">
          <label>Descripcion:</label>
          <textarea
            value={editForm.description || ''}
            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Descripcion del comercio..."
            rows={3}
          />
        </div>

        <div className="field">
          <label>Tags (separados por coma):</label>
          <input
            value={(editForm.tags || []).join(', ')}
            onChange={e => setEditForm({ ...editForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            placeholder="tag1, tag2, tag3"
          />
        </div>

        <div className="btn-row">
          <button className="btn-primary" onClick={handleSave}>Guardar</button>
          <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel commerce-panel">
      <div className="panel-header">
        <h2>Comercios</h2>
        <button className="btn-small" onClick={handleNewCommerce}>+ Nuevo</button>
      </div>

      {/* Search */}
      <div className="field">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar comercio..."
          className="search-input"
        />
      </div>

      {/* Category filters */}
      <div className="category-filters">
        <button
          className={`cat-btn ${!categoryFilter ? 'active' : ''}`}
          onClick={() => setCategoryFilter(null)}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`cat-btn ${categoryFilter === cat ? 'active' : ''}`}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            title={CATEGORY_LABELS[cat]}
          >
            {CATEGORY_ICONS[cat]}
          </button>
        ))}
      </div>

      {/* Commerce list */}
      <div className="commerce-list">
        {filtered.length === 0 && (
          <p className="empty-msg">No se encontraron comercios</p>
        )}
        {filtered.map(commerce => (
          <div
            key={commerce.id}
            className={`commerce-card ${selectedCommerce?.id === commerce.id ? 'selected' : ''}`}
            onClick={() => setSelectedCommerce(commerce)}
          >
            <div className="commerce-header">
              <span className="commerce-icon">{CATEGORY_ICONS[commerce.category]}</span>
              <div className="commerce-info">
                <strong>{commerce.name}</strong>
                <small>Mz {commerce.blockId}{commerce.houseNumber ? `, Casa ${commerce.houseNumber}` : ''}</small>
              </div>
            </div>
            <p className="commerce-desc">{commerce.description}</p>
            <div className="commerce-meta">
              <span>{commerce.schedule}</span>
            </div>
            <div className="commerce-tags">
              {commerce.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <div className="commerce-actions">
              <button className="btn-small btn-nav" onClick={(e) => { e.stopPropagation(); handleNavigateTo(commerce); }}>
                Ir
              </button>
              {commerce.whatsapp && (
                <a
                  className="btn-small btn-wa"
                  href={`https://wa.me/${commerce.whatsapp.replace(/\+/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                >
                  WhatsApp
                </a>
              )}
              <button className="btn-small" onClick={(e) => { e.stopPropagation(); handleEdit(commerce); }}>
                Editar
              </button>
              <button className="btn-small btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(commerce.id); }}>
                X
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
