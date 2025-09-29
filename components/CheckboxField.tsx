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
          className="h-4 w-4 rounded border-slate-600 bg-slate-800/50 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div className="ml-3 text-sm leading-6">
        <label htmlFor={id} className={`font-medium ${disabled ? 'text-slate-500' : 'text-slate-300'}`}>
          {label}
        </label>
      </div>
    </div>
  );
};

export default CheckboxField;
