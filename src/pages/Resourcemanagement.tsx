import React, { useState, useEffect } from "react";
import "../components/Resourcemanagement.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "Material" | "Equipment";
type Status = "In stock" | "Low stock" | "Available" | "Low Availability";

interface Resource {
  id: number;
  name: string;
  supplier: string;
  category: Category;
  quantity: number;
  unit: string;
  minThreshold: number;
  unitPrice: number;
  project: string;
  status: Status;
  updatedAt: string;
}

interface NewResourceForm {
  name: string;
  category: Category;
  quantity: string;
  unit: string;
  minThreshold: string;
  unitPrice: string;
  supplier: string;
  assignedProject: string;
}


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const PROJECTS = ["Downtown Office Complex", "Riverside Bridge Renovation", "Northside Residential"];

const emptyForm: NewResourceForm = {
  name: "", category: "Material", quantity: "", unit: "",
  minThreshold: "", unitPrice: "", supplier: "", assignedProject: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const peso = (n: number) => "₱" + n.toLocaleString("en-PH");

const statusClass = (s: Status) => {
  if (s === "In stock" || s === "Available") return "badge badge--green";
  if (s === "Low stock" || s === "Low Availability") return "badge badge--red";
  return "badge";
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
    <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
    <path d="M6 4h8M4 6h12M7 6v9a1 1 0 001 1h4a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

const ResourceManagement: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [form, setForm] = useState<NewResourceForm>(emptyForm);
  const [editForm, setEditForm] = useState<NewResourceForm>(emptyForm);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All Resources");
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterStatus, setFilterStatus] = useState("All Status");

  // ── Fetch all resources on mount ──────────────────────────────────────────
  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND_URL}/resources`);
      if (!res.ok) throw new Error("Failed to fetch resources");
      const json = await res.json();
      setResources(json.data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const materials  = resources.filter(r => r.category === "Material");
  const equipments = resources.filter(r => r.category === "Equipment");
  const lowStock   = resources.filter(r => r.status === "Low stock" || r.status === "Low Availability");
  const totalValue = resources.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filtered = resources.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch   = !q || r.name.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q);
    const matchType     = filterType     === "All Resources"   || r.category === filterType;
    const matchCat      = filterCategory === "All Categories"  || r.category === filterCategory;
    const matchStatus   = filterStatus   === "All Status"      || r.status   === filterStatus;
    return matchSearch && matchType && matchCat && matchStatus;
  });

  const filteredMaterials  = filtered.filter(r => r.category === "Material");
  const filteredEquipments = filtered.filter(r => r.category === "Equipment");

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── CREATE ────────────────────────────────────────────────────────────────
  const handleAddResource = async () => {
    if (!form.name || !form.quantity || !form.unitPrice || !form.assignedProject) return;

    try {
      const res = await fetch(`${BACKEND_URL}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         form.name,
          supplier:     form.supplier,
          category:     form.category,
          quantity:     parseFloat(form.quantity),
          unit:         form.unit,
          minThreshold: parseFloat(form.minThreshold) || 0,
          unitPrice:    parseFloat(form.unitPrice),
          project:      form.assignedProject,
        }),
      });

      if (!res.ok) throw new Error("Failed to add resource");
      const json = await res.json();
      setResources(prev => [...prev, json.data]);
      setForm(emptyForm);
      setShowModal(false);
    } catch (err: any) {
      alert(err.message || "Failed to add resource");
    }
  };

  // ── EDIT (open modal) ─────────────────────────────────────────────────────
  const handleEditOpen = (r: Resource) => {
    setEditingResource(r);
    setEditForm({
      name:            r.name,
      category:        r.category,
      quantity:        String(r.quantity),
      unit:            r.unit,
      minThreshold:    String(r.minThreshold),
      unitPrice:       String(r.unitPrice),
      supplier:        r.supplier,
      assignedProject: r.project,
    });
    setShowEditModal(true);
  };

  // ── UPDATE ────────────────────────────────────────────────────────────────
  const handleUpdateResource = async () => {
    if (!editingResource) return;

    try {
      const res = await fetch(`${BACKEND_URL}/resources/${editingResource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         editForm.name,
          supplier:     editForm.supplier,
          category:     editForm.category,
          quantity:     parseFloat(editForm.quantity),
          unit:         editForm.unit,
          minThreshold: parseFloat(editForm.minThreshold) || 0,
          unitPrice:    parseFloat(editForm.unitPrice),
          project:      editForm.assignedProject,
        }),
      });

      if (!res.ok) throw new Error("Failed to update resource");
      const json = await res.json();
      setResources(prev => prev.map(r => r.id === editingResource.id ? json.data : r));
      setShowEditModal(false);
      setEditingResource(null);
    } catch (err: any) {
      alert(err.message || "Failed to update resource");
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this resource?")) return;

    try {
      const res = await fetch(`${BACKEND_URL}/resources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete resource");
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete resource");
    }
  };

  // ── Resource Card ─────────────────────────────────────────────────────────
  const ResourceCard = ({ r }: { r: Resource }) => (
    <div className="res-card">
      <div className="res-card__header">
        <div>
          <div className="res-card__name">{r.name}</div>
          <div className="res-card__supplier">{r.supplier}</div>
        </div>
        <div className="res-card__actions">
          <button className="icon-btn icon-btn--edit" title="Edit" onClick={() => handleEditOpen(r)}>
            <EditIcon />
          </button>
          <button className="icon-btn icon-btn--delete" title="Delete" onClick={() => handleDelete(r.id)}>
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="res-card__rows">
        <div className="res-card__row"><span>Quantity:</span>     <span>{r.quantity} {r.unit}</span></div>
        <div className="res-card__row"><span>Min Threshold:</span><span>{r.minThreshold} {r.unit}</span></div>
        <div className="res-card__row"><span>Unit Price:</span>   <span>{peso(r.unitPrice)}</span></div>
        <div className="res-card__row"><span>Total Value:</span>  <span>{peso(r.quantity * r.unitPrice)}</span></div>
      </div>

      <div className="res-card__project">Project: {r.project}</div>
      <div className="res-card__footer">
        <span className={statusClass(r.status)}>{r.status}</span>
        <span className="res-card__date">Updated: {r.updatedAt}</span>
      </div>
    </div>
  );

  // ── Shared form fields (used in both Add & Edit modals) ───────────────────
  const ResourceFormFields = ({
    values,
    onChange,
  }: {
    values: NewResourceForm;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  }) => (
    <div className="modal-form">
      <div className="form-row form-row--2">
        <div className="form-group">
          <label>Name <span className="required">*</span></label>
          <input name="name" value={values.name} onChange={onChange} className="form-input" />
        </div>
        <div className="form-group">
          <label>Category <span className="required">*</span></label>
          <div className="select-wrap">
            <select name="category" value={values.category} onChange={onChange} className="form-select">
              <option value="Material">Material</option>
              <option value="Equipment">Equipment</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-row form-row--3">
        <div className="form-group">
          <label>Quantity <span className="required">*</span></label>
          <input name="quantity" type="number" value={values.quantity} onChange={onChange} className="form-input" />
        </div>
        <div className="form-group">
          <label>Unit <span className="required">*</span></label>
          <input name="unit" value={values.unit} onChange={onChange} className="form-input" placeholder="tons, m³, units" />
        </div>
        <div className="form-group">
          <label>Min Threshold <span className="required">*</span></label>
          <input name="minThreshold" type="number" value={values.minThreshold} onChange={onChange} className="form-input" />
        </div>
      </div>

      <div className="form-row form-row--2">
        <div className="form-group">
          <label>Unit Price <span className="required">*</span></label>
          <input name="unitPrice" type="number" value={values.unitPrice} onChange={onChange} className="form-input" />
        </div>
        <div className="form-group">
          <label>Supplier <span className="required">*</span></label>
          <input name="supplier" value={values.supplier} onChange={onChange} className="form-input" />
        </div>
      </div>

      <div className="form-row form-row--1">
        <div className="form-group">
          <label>Assigned Project <span className="required">*</span></label>
          <div className="select-wrap">
            <select name="assignedProject" value={values.assignedProject} onChange={onChange} className="form-select">
              <option value="">Select a project</option>
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rm-container">

      {/* ── Page Header ── */}
      <div className="rm-page-header">
        <div>
          <h1 className="rm-title">Resource Management</h1>
          <p className="rm-subtitle">Track materials, equipment, and inventory by project</p>
        </div>
        <button className="btn-add-resource" onClick={() => setShowModal(true)}>
          + Add Resource
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="rm-stats">
        <div className="stat-card">
          <span className="stat-label">Materials</span>
          <span className="stat-value">{materials.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Equipments</span>
          <span className="stat-value">{equipments.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Low Stock Alert</span>
          <span className="stat-value">{lowStock.length}</span>
        </div>
        <div className="stat-card stat-card--wide">
          <span className="stat-label">Total Value</span>
          <span className="stat-value stat-value--large">{peso(totalValue)}</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rm-filters">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="#999" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="#999" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="rm-search"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="rm-select-wrap">
          <select className="rm-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option>All Resources</option>
            <option>Material</option>
            <option>Equipment</option>
          </select>
        </div>
        <div className="rm-select-wrap">
          <select className="rm-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option>All Categories</option>
            <option>Material</option>
            <option>Equipment</option>
          </select>
        </div>
        <div className="rm-select-wrap">
          <select className="rm-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option>All Status</option>
            <option>In stock</option>
            <option>Low stock</option>
            <option>Available</option>
            <option>Low Availability</option>
          </select>
        </div>
      </div>

      {/* ── Loading / Error states ── */}
      {loading && <div className="rm-empty">Loading resources...</div>}
      {error   && <div className="rm-empty" style={{ color: "red" }}>{error}</div>}

      {/* ── Materials Section ── */}
      {!loading && filteredMaterials.length > 0 && (
        <section className="rm-section">
          <h2 className="rm-section-title">Materials</h2>
          <div className="rm-grid">
            {filteredMaterials.map(r => <ResourceCard key={r.id} r={r} />)}
          </div>
        </section>
      )}

      {/* ── Equipments Section ── */}
      {!loading && filteredEquipments.length > 0 && (
        <section className="rm-section">
          <h2 className="rm-section-title">Equipments</h2>
          <div className="rm-grid">
            {filteredEquipments.map(r => <ResourceCard key={r.id} r={r} />)}
          </div>
        </section>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rm-empty">No resources match your filters.</div>
      )}

      {/* ── Add Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add New Resource</h2>
            <p className="modal-subtitle">Add a new material or equipment to a specific project</p>
            <ResourceFormFields values={form} onChange={handleFormChange} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setShowModal(false); setForm(emptyForm); }}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleAddResource}>
                Add Resource
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && editingResource && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Edit Resource</h2>
            <p className="modal-subtitle">Update the details of this resource</p>
            <ResourceFormFields values={editForm} onChange={handleEditFormChange} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setShowEditModal(false); setEditingResource(null); }}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleUpdateResource}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResourceManagement;