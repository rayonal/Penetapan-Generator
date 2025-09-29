import React from 'react';

interface CheckboxFieldProps {
  id: string;
  name: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({ id, name, label, checked, onChange, disabled = false }) => {
  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div className="ml-3 text-sm leading-6">
        <label htmlFor={id} className={`font-medium text-slate-900 ${disabled ? 'text-slate-400' : ''}`}>
          {label}
        </label>
      </div>
    </div>
  );
};

export default CheckboxField;