import { transformFederalRegisterOrder, transformFederalRegisterOrders } from '@/lib/transformers/executive-orders';
import { FederalRegisterOrder } from '@/lib/types/api';
import { describe, expect, it } from 'vitest';
import { createTestData } from '../fixtures/testDataFactory';

const testData = createTestData();

describe('Executive Orders Transformer', () => {
  const mockOrder: FederalRegisterOrder = testData.executiveOrders[0] as any;

  describe('transformFederalRegisterOrder', () => {
    it('should transform a federal register order correctly', () => {
      const result = transformFederalRegisterOrder(mockOrder);

      expect(result).toMatchObject({
        id: mockOrder.document_number,
        title: mockOrder.title,
        date: mockOrder.signing_date,
        orderNumber: mockOrder.executive_order_number,
        summary: mockOrder.abstract,
        category: mockOrder.agencies[0].name,
      });
    });

    it('should handle missing executive order number', () => {
      const orderWithoutNumber = { ...mockOrder };
      delete (orderWithoutNumber as any).executive_order_number;

      const result = transformFederalRegisterOrder(orderWithoutNumber);

      expect(result.orderNumber).toBe(0);
    });

    it('should handle empty agencies array', () => {
      const orderWithoutAgencies = { ...mockOrder, agencies: [] };

      const result = transformFederalRegisterOrder(orderWithoutAgencies);

      expect(result.category).toBe('Uncategorized');
    });

    it('should create proper content structure', () => {
      const result = transformFederalRegisterOrder(mockOrder);

      expect(result.content).toMatchObject({
        html: mockOrder.body_html,
        rawText: undefined,
        xml: undefined,
        sections: [],
      });
    });

    it('should create proper links structure', () => {
      const result = transformFederalRegisterOrder(mockOrder);

      expect(result.links).toMatchObject({
        htmlUrl: mockOrder.html_url,
        pdfUrl: mockOrder.pdf_url,
        bodyHtmlUrl: mockOrder.body_html_url,
        rawTextUrl: mockOrder.raw_text_url,
        fullTextXmlUrl: mockOrder.full_text_xml_url,
        modsUrl: mockOrder.mods_url,
      });
    });

    it('should create proper publication structure', () => {
      const result = transformFederalRegisterOrder(mockOrder);

      expect(result.publication).toMatchObject({
        citation: mockOrder.citation,
        volume: mockOrder.volume,
        startPage: mockOrder.start_page,
        endPage: mockOrder.end_page,
        publicationDate: mockOrder.publication_date,
        signingDate: mockOrder.signing_date,
      });
    });

    it('should initialize empty related orders', () => {
      const result = transformFederalRegisterOrder(mockOrder);

      expect(result.relatedOrders).toEqual([]);
    });
  });

  describe('transformFederalRegisterOrders', () => {
    it('should transform multiple orders', () => {
      const orders = [mockOrder, { ...mockOrder, document_number: '2025-00002' }];

      const result = transformFederalRegisterOrders(orders);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockOrder.document_number);
      expect(result[1].id).toBe('2025-00002');
    });

    it('should handle empty array', () => {
      const result = transformFederalRegisterOrders([]);

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle order with missing abstract', () => {
      const orderWithoutAbstract = { ...mockOrder };
      delete (orderWithoutAbstract as any).abstract;

      const result = transformFederalRegisterOrder(orderWithoutAbstract);

      expect(result.summary).toBe(`Executive Order ${mockOrder.executive_order_number}`);
    });

    it('should handle order with missing abstract and number', () => {
      const orderMinimal = { ...mockOrder };
      delete (orderMinimal as any).abstract;
      delete (orderMinimal as any).executive_order_number;

      const result = transformFederalRegisterOrder(orderMinimal);

      expect(result.summary).toBe('Executive Order N/A');
    });
  });
});
