"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  PlusCircle,
  MoreVertical
} from "lucide-react";
import toast from "react-hot-toast";

interface FieldItem {
  id: string;
  label: string;
  value: string;
}

interface AdditionalDriver {
  id: number; // 1 to 5
  fields: FieldItem[];
}

const DEFAULT_MAIN_FIELDS: FieldItem[] = [
  { id: "main-ph", label: "PH –", value: "" },
  { id: "main-occ", label: "Occupation –", value: "" },
  { id: "main-ind", label: "Industry –", value: "" },
  { id: "main-lic", label: "1. Licence obtained date :", value: "" },
  { id: "main-rel", label: "2. Relationship status :", value: "" },
  { id: "main-acc", label: "3. Access to other car :", value: "" },
  { id: "main-mil", label: "4. Mileage:", value: "" },
  { id: "main-res", label: "5. UK Residency:", value: "" },
  { id: "main-val", label: "6. Vehicle Value:", value: "" },
  { id: "main-use", label: "7. Use of Vehicle :", value: "" },
  { id: "main-pur", label: "8. Vehicle purchase date:", value: "" },
  { id: "main-own", label: "9. Homeowner:", value: "" },
  { id: "main-day", label: "10. Day:", value: "" },
  { id: "main-ngt", label: "11. Night:", value: "" },
  { id: "main-raw", label: "12. Raw quote reference:", value: "" },
  { id: "main-cnt", label: "13. How many cars in the household:", value: "" },
  { id: "main-chd", label: "14. Children:", value: "" },
  { id: "main-ncd", label: "15. NCD:", value: "" },
  { id: "main-row", label: "16. Registered Owner :", value: "" },
  { id: "main-rkp", label: "17. Registered Keeper:", value: "" }
];

const getDriverDefaultFields = (id: number): FieldItem[] => {
  const paddedId = String(id).padStart(2, "0");
  return [
    { id: `drv-${id}-rel`, label: `PH Relationship with the Add Driver ${paddedId}:`, value: "" },
    { id: `drv-${id}-name`, label: `Add ${paddedId}: –`, value: "" },
    { id: `drv-${id}-occ`, label: "Occupation –", value: "" },
    { id: `drv-${id}-ind`, label: "Industry –", value: "" },
    { id: `drv-${id}-lic`, label: "Licence obtained date", value: "" },
    { id: `drv-${id}-rel_status`, label: "Relationship status :", value: "" },
    { id: `drv-${id}-acc`, label: "Access to other car :", value: "" },
    { id: `drv-${id}-res`, label: "UK Residency:", value: "" }
  ];
};

export const AsitisCausalityPanel: React.FC = () => {
  const [mainFields, setMainFields] = useState<FieldItem[]>(DEFAULT_MAIN_FIELDS);
  const [drivers, setDrivers] = useState<AdditionalDriver[]>([]);
  const [copied, setCopied] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    fieldId: string;
    driverId?: number; // undefined for main fields
  } | null>(null);

  // Label inline editing state
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [tempLabelVal, setTempLabelVal] = useState("");

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quotes_asitis_causality_state");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.mainFields) setMainFields(parsed.mainFields);
          if (parsed.drivers) setDrivers(parsed.drivers);
        } catch (e) {
          console.error("Failed to load saved Asitis Causality state:", e);
        }
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stateToSave = { mainFields, drivers };
      localStorage.setItem("quotes_asitis_causality_state", JSON.stringify(stateToSave));
    }
  }, [mainFields, drivers]);

  // Focus label editing input
  useEffect(() => {
    if (editingLabelId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingLabelId]);

  // Handle click outside to close context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Set up values change handlers
  const handleMainValueChange = (id: string, val: string) => {
    setMainFields((prev) => prev.map((f) => (f.id === id ? { ...f, value: val } : f)));
  };

  const handleDriverValueChange = (driverId: number, fieldId: string, val: string) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              fields: d.fields.map((f) => (f.id === fieldId ? { ...f, value: val } : f))
            }
          : d
      )
    );
  };

  // Add field below action
  const addFieldBelow = (targetId: string, driverId?: number) => {
    const newField: FieldItem = {
      id: `custom-${Date.now()}`,
      label: "Custom Field –",
      value: ""
    };

    if (driverId === undefined) {
      setMainFields((prev) => {
        const index = prev.findIndex((f) => f.id === targetId);
        if (index === -1) return prev;
        const next = [...prev];
        next.splice(index + 1, 0, newField);
        return next;
      });
    } else {
      setDrivers((prev) =>
        prev.map((d) => {
          if (d.id !== driverId) return d;
          const index = d.fields.findIndex((f) => f.id === targetId);
          if (index === -1) return d;
          const nextFields = [...d.fields];
          nextFields.splice(index + 1, 0, newField);
          return { ...d, fields: nextFields };
        })
      );
    }
    setContextMenu(null);
    // Open editing instantly for the new label
    setEditingLabelId(newField.id);
    setTempLabelVal(newField.label);
  };

  // Delete field action
  const deleteField = (targetId: string, driverId?: number) => {
    if (driverId === undefined) {
      setMainFields((prev) => prev.filter((f) => f.id !== targetId));
    } else {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId
            ? { ...d, fields: d.fields.filter((f) => f.id !== targetId) }
            : d
        )
      );
    }
    setContextMenu(null);
  };

  // Trigger inline label editing
  const startEditingLabel = (fieldId: string, currentLabel: string) => {
    setEditingLabelId(fieldId);
    setTempLabelVal(currentLabel);
    setContextMenu(null);
  };

  // Save edited label
  const saveLabelEdit = () => {
    if (!editingLabelId) return;
    setMainFields((prev) =>
      prev.map((f) => (f.id === editingLabelId ? { ...f, label: tempLabelVal } : f))
    );
    setDrivers((prev) =>
      prev.map((d) => ({
        ...d,
        fields: d.fields.map((f) => (f.id === editingLabelId ? { ...f, label: tempLabelVal } : f))
      }))
    );
    setEditingLabelId(null);
  };

  // Handle right-click context trigger
  const handleContextMenuTrigger = (
    e: React.MouseEvent,
    fieldId: string,
    driverId?: number
  ) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      fieldId,
      driverId
    });
  };

  // Add additional driver
  const handleAddDriver = () => {
    if (drivers.length >= 5) {
      toast.error("You can add up to 5 additional drivers only.");
      return;
    }
    const nextId = drivers.length + 1;
    setDrivers((prev) => [
      ...prev,
      { id: nextId, fields: getDriverDefaultFields(nextId) }
    ]);
  };

  // Remove additional driver
  const handleRemoveDriver = (id: number) => {
    setDrivers((prev) => prev.filter((d) => d.id !== id).map((d, index) => {
      // Re-index remaining drivers to be sequential
      const newId = index + 1;
      const prevFields = d.fields;
      
      // Update label index names e.g., "Add 02: –" to "Add 01: –" if driver 1 was deleted
      const updatedFields = prevFields.map(f => {
        let label = f.label;
        const oldPadded = String(d.id).padStart(2, "0");
        const newPadded = String(newId).padStart(2, "0");
        
        if (label.includes(`Driver ${oldPadded}`)) {
          label = label.replace(`Driver ${oldPadded}`, `Driver ${newPadded}`);
        }
        if (label.includes(`Add ${oldPadded}`)) {
          label = label.replace(`Add ${oldPadded}`, `Add ${newPadded}`);
        }
        return { ...f, label };
      });

      return { id: newId, fields: updatedFields };
    }));
  };

  // Reset all fields to default empty states
  const handleReset = () => {
    if (!confirm("Are you sure you want to reset all fields and remove additional drivers?")) return;
    setMainFields(DEFAULT_MAIN_FIELDS.map(f => ({ ...f, value: "" })));
    setDrivers([]);
    localStorage.removeItem("quotes_asitis_causality_state");
    toast.success("Form reset to default successfully.");
  };

  // Build the formatted string to copy
  const getCopyFormattedText = (): string => {
    let result = "";
    
    // 1. Add main fields
    mainFields.forEach((f) => {
      result += `${f.label} ${f.value}\n`;
    });

    // 2. Add additional drivers if any exist
    drivers.forEach((d) => {
      result += "\n"; // extra line gap
      d.fields.forEach((f) => {
        result += `${f.label} ${f.value}\n`;
      });
    });

    return result;
  };

  // Copy formatting action
  const handleCopyText = async () => {
    const text = getCopyFormattedText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Form formatted text copied successfully!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy text.");
    }
  };

  return (
    <div className="bg-slate-955/20 border border-slate-850 rounded-2xl p-5 space-y-6 animate-fade-in relative min-h-[70vh]">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-850/60 pb-4 border-dashed">
        <div>
          <h4 className="text-md font-bold text-white flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-indigo-500" />
            Asitis Causality Document Helper
          </h4>
          <p className="text-[11px] text-slate-450 mt-0.5">
            Fill fields, customize layout, add drivers, and copy for MS Word. Right-click any field for layout actions.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Reset Form"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Default
          </button>
          <button
            onClick={handleCopyText}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-md ${
              copied
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                : "bg-indigo-650 hover:bg-indigo-600 border-indigo-600/30 text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Format
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Inputs: 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Field Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Main Applicant Fields</h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
              {mainFields.map((field) => {
                const isEditing = editingLabelId === field.id;
                return (
                  <div
                    key={field.id}
                    className="flex flex-col gap-1 group relative rounded-lg"
                    onContextMenu={(e) => handleContextMenuTrigger(e, field.id)}
                  >
                    {/* Inline edit label or static text */}
                    {isEditing ? (
                      <input
                        ref={editingInputRef}
                        type="text"
                        value={tempLabelVal}
                        onChange={(e) => setTempLabelVal(e.target.value)}
                        onBlur={saveLabelEdit}
                        onKeyDown={(e) => e.key === "Enter" && saveLabelEdit()}
                        className="bg-slate-950 text-xs text-white border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none w-full"
                      />
                    ) : (
                      <div className="flex items-center justify-between text-slate-400 text-xs font-semibold select-none">
                        <span className="truncate">{field.label}</span>
                        {/* Hover option triggers context menu */}
                        <button
                          type="button"
                          onClick={(e) => handleContextMenuTrigger(e, field.id)}
                          className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity p-0.5 cursor-pointer"
                          title="Field options"
                        >
                          <MoreVertical className="h-3 w-3 text-slate-500" />
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      value={field.value}
                      placeholder="..."
                      onChange={(e) => handleMainValueChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-xs transition-all"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Drivers cards */}
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4 animate-fade-in relative"
            >
              <div className="flex justify-between items-center border-b border-slate-850/60 pb-2 border-dashed">
                <h5 className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                  Additional Driver {String(driver.id).padStart(2, "0")}
                </h5>
                <button
                  type="button"
                  onClick={() => handleRemoveDriver(driver.id)}
                  className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md transition-all cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                {driver.fields.map((field) => {
                  const isEditing = editingLabelId === field.id;
                  return (
                    <div
                      key={field.id}
                      className="flex flex-col gap-1 group relative"
                      onContextMenu={(e) => handleContextMenuTrigger(e, field.id, driver.id)}
                    >
                      {isEditing ? (
                        <input
                          ref={editingInputRef}
                          type="text"
                          value={tempLabelVal}
                          onChange={(e) => setTempLabelVal(e.target.value)}
                          onBlur={saveLabelEdit}
                          onKeyDown={(e) => e.key === "Enter" && saveLabelEdit()}
                          className="bg-slate-955 text-xs text-white border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none w-full"
                        />
                      ) : (
                        <div className="flex items-center justify-between text-slate-455 text-xs font-semibold select-none">
                          <span className="truncate">{field.label}</span>
                          <button
                            type="button"
                            onClick={(e) => handleContextMenuTrigger(e, field.id, driver.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity p-0.5 cursor-pointer"
                          >
                            <MoreVertical className="h-3 w-3 text-slate-500" />
                          </button>
                        </div>
                      )}

                      <input
                        type="text"
                        value={field.value}
                        placeholder="..."
                        onChange={(e) => handleDriverValueChange(driver.id, field.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-xs transition-all"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add Additional Driver Button */}
          {drivers.length < 5 && (
            <button
              onClick={handleAddDriver}
              className="w-full flex items-center justify-center gap-2 py-3.5 border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-xl bg-transparent hover:bg-slate-900/20 text-slate-400 hover:text-indigo-400 transition-all font-semibold text-xs cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              Add Additional Driver {String(drivers.length + 1).padStart(2, "0")}
            </button>
          )}
        </div>

        {/* Live Copy Preview: 5 Cols */}
        <div className="lg:col-span-5 space-y-3">
          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Copy Format Preview</h5>
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs font-mono text-slate-300 h-[65vh] overflow-y-auto custom-scrollbar select-text whitespace-pre-wrap leading-relaxed shadow-inner">
            {getCopyFormattedText()}
          </div>
        </div>
      </div>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1.5 w-40 z-50 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              const target = (contextMenu.driverId === undefined) 
                ? mainFields.find(f => f.id === contextMenu.fieldId) 
                : drivers.find(d => d.id === contextMenu.driverId)?.fields.find(f => f.id === contextMenu.fieldId);
              if (target) {
                startEditingLabel(contextMenu.fieldId, target.label);
              }
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
            Edit Label
          </button>
          <button
            onClick={() => addFieldBelow(contextMenu.fieldId, contextMenu.driverId)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            Add Field Below
          </button>
          <button
            onClick={() => deleteField(contextMenu.fieldId, contextMenu.driverId)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-xs text-red-400 hover:text-red-300 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
            Delete Field
          </button>
        </div>
      )}
    </div>
  );
};
