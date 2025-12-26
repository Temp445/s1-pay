import React, { useState } from 'react';
import { Cog, User, Building2, Sliders, Bell, Lock, CreditCard, Calendar, Users, FileText, Clock, Shield, Database, Upload } from 'lucide-react';
import UserSettings from './UserSettings';
import CompanySettings from './CompanySettings';
import FunctionalSettings from './FunctionalSettings';
import MasterDataImport from './MasterDataImport';
import TenantSettings from './TenantSettings';
import StatutorySettings from './StatutorySettings';

type SettingsTab = 'user' | 'company' | 'functional' | 'import' | 'organization' | 'statutory';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('user');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveSettings = async (data: any, settingsType: SettingsTab) => {
    try {
      setSaveStatus('saving');
      setErrorMessage(null);
      
      // Simulate API call with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real implementation, you would save to your backend here
      console.log(`Saving ${settingsType} settings:`, data);
      
      setSaveStatus('success');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings');
      
      // Reset error after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your account, company, and application settings.
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {saveStatus === 'success' && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Settings saved successfully
                </p>
              </div>
            </div>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {errorMessage || 'Failed to save settings'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'user'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('user')}
                >
                  <User className="h-5 w-5 inline-block mr-2" />
                  User Settings
                </button>
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'company'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('company')}
                >
                  <Building2 className="h-5 w-5 inline-block mr-2" />
                  Company Settings
                </button>
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'organization'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('organization')}
                >
                  <Building2 className="h-5 w-5 inline-block mr-2" />
                  Organization
                </button>
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'statutory'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('statutory')}
                >
                  <Shield className="h-5 w-5 inline-block mr-2" />
                  Statutory
                </button>
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'import'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('import')}
                >
                  <Upload className="h-5 w-5 inline-block mr-2" />
                  Master Data Import
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'user' && (
                <UserSettings onSave={(data) => handleSaveSettings(data, 'user')} isSaving={saveStatus === 'saving'} />
              )}

              {activeTab === 'company' && (
                <CompanySettings onSave={(data) => handleSaveSettings(data, 'company')} isSaving={saveStatus === 'saving'} />
              )}

              {activeTab === 'organization' && (
                <TenantSettings />
              )}

              {activeTab === 'functional' && (
                <FunctionalSettings onSave={(data) => handleSaveSettings(data, 'functional')} isSaving={saveStatus === 'saving'} />
              )}

              {activeTab === 'statutory' && (
                <StatutorySettings />
              )}

              {activeTab === 'import' && (
                <MasterDataImport />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Import status icons
import { CheckCircle, XCircle } from 'lucide-react';