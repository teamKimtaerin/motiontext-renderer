import { describe, test, expect } from 'vitest';
import { applyInheritance } from '../InheritanceV2';
import type { Scenario, GroupNode, TextNode } from '../../types/scenario-v2';
import type { TextStyle, BoxStyle } from '../../types/layout';

describe('BoxStyle Inheritance System', () => {
  describe('Track defaultBoxStyle inheritance', () => {
    test('should inherit defaultBoxStyle from track to group nodes', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1,
            defaultStyle: {
              fontFamily: 'Arial',
              color: '#ffffff'
            } as TextStyle,
            defaultBoxStyle: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              borderRadius: '4px',
              padding: '8px 12px'
            } as BoxStyle
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'group1',
              eType: 'group',
              children: [
                {
                  id: 'text1',
                  eType: 'text',
                  text: 'Hello World'
                } as TextNode
              ]
            } as GroupNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const groupNode = result.cues[0].root as any;

      // Group should inherit defaultBoxStyle from track
      expect(groupNode.boxStyle).toEqual({
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: '4px',
        padding: '8px 12px'
      });

      // Text child should not have boxStyle
      expect(groupNode.children[0].boxStyle).toBeUndefined();
    });

    test('should not inherit defaultBoxStyle to text nodes', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1,
            defaultBoxStyle: {
              backgroundColor: 'rgba(0,0,0,0.8)'
            } as BoxStyle
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'text1',
              eType: 'text',
              text: 'Hello World'
            } as TextNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const textNode = result.cues[0].root as any;

      // Text node should not have boxStyle even if track has defaultBoxStyle
      expect(textNode.boxStyle).toBeUndefined();
    });
  });

  describe('Group boxStyle override', () => {
    test('should override track defaultBoxStyle with node boxStyle', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1,
            defaultBoxStyle: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: '8px'
            } as BoxStyle
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'group1',
              eType: 'group',
              boxStyle: {
                backgroundColor: 'rgba(255,0,0,0.5)',
                borderRadius: '8px'
              } as BoxStyle,
              children: []
            } as GroupNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const groupNode = result.cues[0].root as any;

      // Should merge track defaults with node override (node takes precedence)
      expect(groupNode.boxStyle).toEqual({
        backgroundColor: 'rgba(255,0,0,0.5)', // overridden
        padding: '8px', // inherited from track
        borderRadius: '8px' // from node
      });
    });
  });

  describe('Backward compatibility - legacy style splitting', () => {
    test('should automatically split legacy style into style and boxStyle', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'group1',
              eType: 'group',
              style: {
                // Text styles
                fontFamily: 'Arial',
                color: '#ffffff',
                fontSize: '16px',
                // Box styles (should be split out)
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderRadius: '4px',
                padding: '8px',
                opacity: 0.9
              } as any, // Legacy combined style
              children: []
            } as GroupNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const groupNode = result.cues[0].root as any;

      // Should have split text styles
      expect(groupNode.style).toEqual({
        fontFamily: 'Arial',
        color: '#ffffff',
        fontSize: '16px'
      });

      // Should have split box styles
      expect(groupNode.boxStyle).toEqual({
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: '4px',
        padding: '8px',
        opacity: 0.9,
        boxBg: undefined,
        border: undefined
      });
    });

    test('should not split if no box properties exist', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'group1',
              eType: 'group',
              style: {
                fontFamily: 'Arial',
                color: '#ffffff',
                fontSize: '16px'
              } as TextStyle,
              children: []
            } as GroupNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const groupNode = result.cues[0].root as any;

      // Should keep text styles as-is
      expect(groupNode.style).toEqual({
        fontFamily: 'Arial',
        color: '#ffffff',
        fontSize: '16px'
      });

      // Should not have boxStyle
      expect(groupNode.boxStyle).toBeUndefined();
    });

    test('should not override existing boxStyle during legacy splitting', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'group1',
              eType: 'group',
              style: {
                fontFamily: 'Arial',
                backgroundColor: 'rgba(0,0,0,0.8)' // This should not be split
              } as any,
              boxStyle: {
                backgroundColor: 'rgba(255,0,0,0.5)' // Existing boxStyle should be preserved
              } as BoxStyle,
              children: []
            } as GroupNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const groupNode = result.cues[0].root as any;

      // Original boxStyle should be preserved
      expect(groupNode.boxStyle).toEqual({
        backgroundColor: 'rgba(255,0,0,0.5)'
      });

      // style should keep the background (not split since boxStyle already exists)
      expect(groupNode.style).toEqual({
        fontFamily: 'Arial',
        backgroundColor: 'rgba(0,0,0,0.8)'
      });
    });
  });

  describe('Text style inheritance', () => {
    test('should inherit text styles from track to all node types', () => {
      const scenario: Scenario = {
        version: '2.0',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 1,
            defaultStyle: {
              fontFamily: 'Arial',
              color: '#ffffff',
              fontSize: '16px'
            } as TextStyle
          }
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            root: {
              id: 'group1',
              eType: 'group',
              children: [
                {
                  id: 'text1',
                  eType: 'text',
                  text: 'Hello World'
                } as TextNode
              ]
            } as GroupNode
          }
        ]
      };

      const result = applyInheritance(scenario);
      const groupNode = result.cues[0].root as any;
      const textNode = groupNode.children[0] as any;

      // Both group and text should inherit text styles from track
      expect(groupNode.style).toEqual({
        fontFamily: 'Arial',
        color: '#ffffff',
        fontSize: '16px'
      });

      expect(textNode.style).toEqual({
        fontFamily: 'Arial',
        color: '#ffffff',
        fontSize: '16px'
      });
    });
  });
});