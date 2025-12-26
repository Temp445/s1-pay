import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Edit3, Upload } from 'lucide-react';
import { useSalaryStructuresStore, type SalaryStructureHeader } from '../../../stores/salaryStructuresStore';
import AddPayStructureModal from './AddPayStructureModal';
import ImportModal from '../../ImportModal';
import { importPayrollComponents } from '../../../lib/import';

export default function SalaryStructuresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructureHeader | null>(null);

  const { items: structures, loading, error, fetchSalaryStructures, deleteSalaryStructure } = useSalaryStructuresStore();

  useEffect(() => {
    fetchSalaryStructures();
  }, [fetchSalaryStructures]);

  const handleStructureCreated = () => {
    fetchSalaryStructures();
  };

  const handleImport = async (data: any[]) => {
    return await importPayrollComponents(data);
  };

  const handleImportComplete = () => {
    fetchSalaryStructures();
  };

  const handleEditStructure = (id: string) => {
    console.log('Edit structure', id);
  };

  const filteredStructures = structures.filter(structure =>
    structure.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    structure.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Salary Structures</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage salary structures and their components
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              // onClick={() => setIsModalOpen(true)}
              onClick={() => {
                setSelectedStructure(null); // ✅ Clear the structure any already set
                setIsModalOpen(true); // ✅ Open the modal
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Structure
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ml-3"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Components
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search salary structures..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Components
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredStructures.map((structure) => (
                      <tr key={structure.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <div className="font-medium text-gray-900">{structure.name}</div>
                          {structure.description && (
                            <div className="text-gray-500">{structure.description}</div>
                          )}
                        </td>
                        {/* <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {structure.components?.length || 0} components
                        </td> */}
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${structure.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {structure.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit structure"
                              onClick={() => {
                                setSelectedStructure(structure); // ✅ Set the structure to edit
                                setIsModalOpen(true); // ✅ Open the modal
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this salary structure?')) {
                                  try {
                                    await deleteSalaryStructure(structure.id!);
                                  } catch (error) {
                                    console.error('Failed to delete salary structure:', error);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                              title="Delete structure"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <AddPayStructureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStructureCreated={handleStructureCreated}
      /> */}

      <AddPayStructureModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStructure(null); // ✅ Clear selection when closing
        }}
        onStructureCreated={handleStructureCreated}
        selectedStructure={selectedStructure} // ✅ Pass selected structure
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          handleImportComplete();
        }}
        entityType="payroll_components"
        entityName="Payroll Components"
        onImport={handleImport}
      />
    </div>
  );
}