import React from 'react';
import { RotateCw as RotateClockwise } from 'lucide-react';

interface RotationPatternSelectorProps {
  value: 'none' | 'daily' | 'weekly' | 'monthly';
  weekInterval: number;
  monthInterval: number;
  onChange: (pattern: 'none' | 'daily' | 'weekly' | 'monthly', interval: number) => void;
}

export default function RotationPatternSelector({
  value,
  weekInterval,
  monthInterval,
  onChange
}: RotationPatternSelectorProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Rotation Pattern
      </label>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <select
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            value={value}
            onChange={(e) => onChange(e.target.value as any, value === 'weekly' ? weekInterval : monthInterval)}
          >
            <option value="none">No Rotation</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {value === 'weekly' && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Weeks Between Rotations
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <RotateClockwise className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                min="1"
                max="52"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                value={weekInterval}
                onChange={(e) => onChange('weekly', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        {value === 'monthly' && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Months Between Rotations
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <RotateClockwise className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                min="1"
                max="12"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                value={monthInterval}
                onChange={(e) => onChange('monthly', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}