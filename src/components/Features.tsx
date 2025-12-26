import React from 'react';
import { Calculator, Clock, Shield, DollarSign, PieChart, Users } from 'lucide-react';

const features = [
  {
    name: 'Automated Calculations',
    description: 'Precise salary calculations with tax deductions and custom rules.',
    icon: Calculator,
  },
  {
    name: 'Time Saving',
    description: 'Process payroll in minutes, not hours, with bulk processing.',
    icon: Clock,
  },
  {
    name: 'Secure Platform',
    description: 'Enterprise-grade security with data encryption and compliance.',
    icon: Shield,
  },
  {
    name: 'Direct Deposits',
    description: 'Seamless integration with banking systems for quick payments.',
    icon: DollarSign,
  },
  {
    name: 'Advanced Analytics',
    description: 'Real-time insights and customizable reporting dashboard.',
    icon: PieChart,
  },
  {
    name: 'Team Management',
    description: 'Comprehensive employee database and leave management.',
    icon: Users,
  },
];

const Features = () => {
  return (
    <div id="features" className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Features</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to manage payroll
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
            Comprehensive payroll management tools designed for modern businesses.
          </p>
        </div>

        <div className="mt-10">
          <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
            {features.map((feature) => (
              <div key={feature.name} className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">{feature.name}</p>
                <p className="mt-2 ml-16 text-base text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;