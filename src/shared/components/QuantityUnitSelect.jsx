import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QUANTITY_UNIT_OPTIONS } from '@/shared/constants/quantityUnits';

const QuantityUnitSelect = ({
  id,
  name = 'unit',
  value = '',
  onValueChange,
  placeholder = 'Select unit',
  required = false,
  disabled = false,
  className = '',
  selectClassName = '',
}) => (
  <div className={cn('relative', className)}>
    <select
      id={id}
      name={name}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      required={required}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selectClassName
      )}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {QUANTITY_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
  </div>
);

export default QuantityUnitSelect;
