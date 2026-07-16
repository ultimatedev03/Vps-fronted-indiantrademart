import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QUANTITY_UNIT_OPTIONS } from '@/shared/constants/quantityUnits';

const CUSTOM_UNIT_VALUE = '__custom_unit__';

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
  allowCustom = false,
  customPlaceholder = 'Enter custom unit',
  customInputClassName = '',
}) => {
  const standardValues = useMemo(
    () => new Set(QUANTITY_UNIT_OPTIONS.map((option) => option.value)),
    []
  );
  const hasCustomValue = Boolean(value) && !standardValues.has(value);
  const [customSelected, setCustomSelected] = useState(allowCustom && hasCustomValue);

  useEffect(() => {
    if (!allowCustom) {
      setCustomSelected(false);
      return;
    }
    if (hasCustomValue) setCustomSelected(true);
    else if (value) setCustomSelected(false);
  }, [allowCustom, hasCustomValue, value]);

  const selectedValue = allowCustom && (customSelected || hasCustomValue)
    ? CUSTOM_UNIT_VALUE
    : value;

  const handleSelectChange = (event) => {
    const nextValue = event.target.value;
    if (allowCustom && nextValue === CUSTOM_UNIT_VALUE) {
      setCustomSelected(true);
      if (!hasCustomValue) onValueChange?.('');
      return;
    }
    setCustomSelected(false);
    onValueChange?.(nextValue);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={selectedValue}
          onChange={handleSelectChange}
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
          {allowCustom && <option value={CUSTOM_UNIT_VALUE}>Other / custom unit</option>}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>

      {allowCustom && (customSelected || hasCustomValue) && (
        <input
          id={id ? `${id}-custom` : undefined}
          name={`${name}_custom`}
          value={hasCustomValue ? value : ''}
          onChange={(event) => onValueChange?.(event.target.value)}
          placeholder={customPlaceholder}
          required={required}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            customInputClassName
          )}
        />
      )}
    </div>
  );
};

export default QuantityUnitSelect;
