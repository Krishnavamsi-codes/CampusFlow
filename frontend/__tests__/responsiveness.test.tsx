import React from 'react';
import { render, screen, act } from '@testing-library/react';
import BottomNav from '../src/components/BottomNav';
import HomePage from '../src/app/page';
import { api } from '../src/utils/api';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock framer-motion and filter custom elements/props to prevent DOM property validation warnings
jest.mock('framer-motion', () => {
  const React = require('react');
  const dummyComponent = (name: string) => {
    const Component = ({ children, whileHover, whileTap, transition, animate, initial, variants, layoutId, exit, ...props }: any, ref: any) => {
      return React.createElement(name, { ...props, ref }, children);
    };
    Component.displayName = `Mocked${name}`;
    return React.forwardRef(Component);
  };
  return {
    motion: {
      div: dummyComponent('div'),
      section: dummyComponent('section'),
      span: dummyComponent('span'),
      button: dummyComponent('button'),
      h1: dummyComponent('h1'),
      h2: dummyComponent('h2'),
      h3: dummyComponent('h3'),
      p: dummyComponent('p'),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock api utility
jest.mock('../src/utils/api', () => ({
  api: {
    getRooms: jest.fn().mockResolvedValue({
      targetDate: '2026-05-25',
      targetTime: '08:50',
      groupedRooms: { G_ROOMS: [], B_ROOMS: [], FIRST_FLOOR: [] },
    }),
  },
}));

describe('Responsiveness and Mobile Viewport Tests', () => {
  const originalInnerWidth = window.innerWidth;

  afterAll(() => {
    window.innerWidth = originalInnerWidth;
  });

  const setViewport = (width: number, height = 800) => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
  };

  test('BottomNav contains positioning classes suitable for mobile screens', () => {
    render(<BottomNav />);

    // Bottom navbar should be fixed at the bottom, centered
    const navContainer = screen.getByRole('navigation').parentElement;
    expect(navContainer).toHaveClass('fixed');
    expect(navContainer).toHaveClass('bottom-6');
    expect(navContainer).toHaveClass('left-1/2');
    expect(navContainer).toHaveClass('-translate-x-1/2');
    expect(navContainer).toHaveClass('w-[calc(100%-2rem)]');
    expect(navContainer).toHaveClass('max-w-sm');
  });

  test('Simulate iPhone 14 Viewport (393px width)', async () => {
    setViewport(393, 852);
    expect(window.innerWidth).toBe(393);
    expect(window.innerHeight).toBe(852);

    await act(async () => {
      render(<HomePage />);
    });

    const searchInput = await screen.findByPlaceholderText('Search classrooms, courses...');
    // The main wrapper should be constrained to max-w-md mx-auto to ensure no horizontal overflow
    const mainWrapper = searchInput.closest('.max-w-md');
    expect(mainWrapper).toBeInTheDocument();
    expect(mainWrapper).toHaveClass('max-w-md');
    expect(mainWrapper).toHaveClass('mx-auto');
    expect(mainWrapper).toHaveClass('px-4');
  });

  test('Simulate Small Android Viewport (360px width)', async () => {
    setViewport(360, 640);
    expect(window.innerWidth).toBe(360);
    expect(window.innerHeight).toBe(640);

    await act(async () => {
      render(<HomePage />);
    });

    const searchInput = await screen.findByPlaceholderText('Search classrooms, courses...');
    expect(searchInput).toBeInTheDocument();
    
    // Check that search container is sticky to remain visible during scrolls
    const stickyContainer = searchInput.closest('.sticky');
    expect(stickyContainer).toBeInTheDocument();
    expect(stickyContainer).toHaveClass('sticky');
    expect(stickyContainer).toHaveClass('top-0');
  });
});
