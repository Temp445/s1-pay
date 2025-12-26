import { Employee } from './employees';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ExportData = Record<string, string | number | boolean | null>;

export function exportToCSV(data: ExportData[], filename: string = 'export.csv') {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);

    // Convert data to CSV format
    const csvContent = [
      // Headers row
      headers.join(','),
      // Data rows
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle different value types
          if (value === null || value === undefined) return '""';
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return value;
        }).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      throw new Error('Browser does not support downloading files');
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

export function exportToPDF(data: ExportData[], filename: string = 'export.pdf') {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Format data for jsPDF-AutoTable
    const tableData = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        return value.toString();
      })
    );

    // Create PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(filename.replace(/_/g, ' ').replace(/\.pdf$/, ''), 14, 22);
    
    // Add generation info
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    // Add table
    (doc as any).autoTable({
      head: [headers.map(header => 
        header
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
      )],
      body: tableData,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [66, 66, 153],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 255]
      }
    });
    
    // Save PDF
    doc.save(filename);
    
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}

export function exportToExcel(data: ExportData[], filename: string = 'export.xlsx') {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Format headers
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!worksheet[address]) continue;
      
      // Format header text
      const headerText = worksheet[address].v;
      worksheet[address].v = headerText
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
    }
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    
    // Save Excel file
    XLSX.writeFile(workbook, filename);
    
  } catch (error) {
    console.error('Excel export failed:', error);
    throw error;
  }
}