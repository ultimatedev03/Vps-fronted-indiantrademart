import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const SELECT_ROLES = {
  content: 'content',
  group: 'group',
  item: 'item',
  label: 'label',
  separator: 'separator',
  trigger: 'trigger',
  value: 'value',
};

const marker = (role, displayName) => {
  const Component = ({ children }) => children ?? null;
  Component.selectRole = role;
  Component.displayName = displayName;
  return Component;
};

const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const getRole = (node) => node?.type?.selectRole;

const flattenText = (children) =>
  React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }

      if (React.isValidElement(child)) {
        return flattenText(child.props.children);
      }

      return '';
    })
    .join('')
    .trim();

const SelectValue = marker(SELECT_ROLES.value, 'SelectValue');
const SelectTrigger = marker(SELECT_ROLES.trigger, 'SelectTrigger');
const SelectContent = marker(SELECT_ROLES.content, 'SelectContent');
const SelectItem = marker(SELECT_ROLES.item, 'SelectItem');
const SelectGroup = marker(SELECT_ROLES.group, 'SelectGroup');
const SelectLabel = marker(SELECT_ROLES.label, 'SelectLabel');
const SelectSeparator = marker(SELECT_ROLES.separator, 'SelectSeparator');
const SelectScrollUpButton = marker('scroll-up', 'SelectScrollUpButton');
const SelectScrollDownButton = marker('scroll-down', 'SelectScrollDownButton');

const buildOptions = (children, keyPrefix = 'opt') => {
  const options = [];

  React.Children.forEach(children, (child, index) => {
    if (!React.isValidElement(child)) return;

    const role = getRole(child);
    const itemKey = child.key ?? `${keyPrefix}-${index}`;

    if (role === SELECT_ROLES.content) {
      options.push(...buildOptions(child.props.children, `${itemKey}-content`));
      return;
    }

    if (role === SELECT_ROLES.group) {
      let label = '';
      const groupedChildren = [];

      React.Children.forEach(child.props.children, (groupChild) => {
        if (!React.isValidElement(groupChild)) return;
        if (getRole(groupChild) === SELECT_ROLES.label) {
          label = flattenText(groupChild.props.children);
          return;
        }

        if (getRole(groupChild) === SELECT_ROLES.separator) return;
        groupedChildren.push(groupChild);
      });

      const groupOptions = buildOptions(groupedChildren, `${itemKey}-group`);
      if (!groupOptions.length) return;

      if (label) {
        options.push(
          <optgroup key={`${itemKey}-optgroup`} label={label}>
            {groupOptions}
          </optgroup>
        );
        return;
      }

      options.push(...groupOptions);
      return;
    }

    if (role === SELECT_ROLES.item) {
      options.push(
        <option
          key={itemKey}
          value={normalizeValue(child.props.value)}
          disabled={Boolean(child.props.disabled)}
        >
          {flattenText(child.props.children)}
        </option>
      );
    }
  });

  return options;
};

const extractTriggerConfig = (children) => {
  let triggerProps = {};
  let placeholder = '';

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || getRole(child) !== SELECT_ROLES.trigger) return;

    const { children: triggerChildren, ...restTriggerProps } = child.props;
    triggerProps = restTriggerProps;

    React.Children.forEach(triggerChildren, (triggerChild) => {
      if (!React.isValidElement(triggerChild) || getRole(triggerChild) !== SELECT_ROLES.value) return;
      placeholder = triggerChild.props.placeholder ?? '';
    });
  });

  return { triggerProps, placeholder };
};

const Select = React.forwardRef(
  (
    {
      children,
      defaultValue,
      disabled = false,
      form,
      name,
      onValueChange,
      required = false,
      value,
      ...restProps
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
      normalizeValue(defaultValue)
    );
    const isControlled = value !== undefined;
    const selectedValue = isControlled ? normalizeValue(value) : uncontrolledValue;
    const { triggerProps, placeholder } = React.useMemo(
      () => extractTriggerConfig(children),
      [children]
    );
    const options = React.useMemo(() => buildOptions(children), [children]);
    const {
      children: _ignoredTriggerChildren,
      className: triggerClassName,
      disabled: triggerDisabled,
      ...triggerRestProps
    } = triggerProps;

    const isDisabled = disabled || Boolean(triggerDisabled);

    const handleChange = (event) => {
      const nextValue = event.target.value;
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    };

    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-10 w-full appearance-none items-center justify-between rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName
          )}
          disabled={isDisabled}
          form={form}
          name={name}
          onChange={handleChange}
          required={required}
          value={selectedValue}
          {...triggerRestProps}
          {...restProps}
        >
          <option value="" disabled={required}>
            {placeholder}
          </option>
          {options}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
      </div>
    );
  }
);

Select.displayName = 'Select';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
