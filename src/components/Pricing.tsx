import React from 'react';
import { Check } from 'lucide-react';

const tiers = [
  {
    name: 'Starter',
    price: 49,
    description: 'Perfect for small businesses',
    features: [
      'Up to 25 employees',
      'Basic payroll processing',
      'Tax calculations',
      'Direct deposit',
      'Employee portal',
      'Email support',
    ],
  },
  {
    name: 'Professional',
    price: 99,
    description: 'For growing companies',
    features: [
      'Up to 100 employees',
      'Advanced payroll features',
      'Multiple pay schedules',
      'Custom deductions',
      'Time tracking integration',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 199,
    description: 'For large organizations',
    features: [
      'Unlimited employees',
      'Custom solutions',
      'API access',
      'Advanced analytics',
      'Dedicated account manager',
      '24/7 phone support',
    ],
  },
];

const Pricing = () => {
  return (
    <div id="pricing" className="bg-gray-900 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-xl text-gray-300">
            Choose the plan that best fits your business needs
          </p>
        </div>
        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="bg-white rounded-lg shadow-lg divide-y divide-gray-200"
            >
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-gray-900">{tier.name}</h3>
                <p className="mt-4 text-gray-500">{tier.description}</p>
                <p className="mt-8">
                  <span className="text-4xl font-extrabold text-gray-900">${tier.price}</span>
                  <span className="text-base font-medium text-gray-500">/month</span>
                </p>
                <button className="mt-8 w-full bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-700">
                  Get started
                </button>
              </div>
              <div className="px-6 pt-6 pb-8">
                <h4 className="text-sm font-medium text-gray-900 tracking-wide uppercase">
                  What's included
                </h4>
                <ul className="mt-6 space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex space-x-3">
                      <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                      <span className="text-base text-gray-500">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pricing;