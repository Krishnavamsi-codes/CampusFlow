import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HomePage from '../src/app/page';
import CRPanelPage from '../src/app/cr/page';
import RoomCard from '../src/components/RoomCard';
import BottomNav from '../src/components/BottomNav';
import { api, getCRUserMeta, getAuthToken } from '../src/utils/api';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ id: 'G09' }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'date' ? '2026-05-25' : null),
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
jest.mock('../src/utils/api', () => {
  const original = jest.requireActual('../src/utils/api');
  return {
    ...original,
    api: {
      getRooms: jest.fn(),
      getRoomDetails: jest.fn(),
      getFreeRooms: jest.fn(),
      login: jest.fn(),
      cancelClass: jest.fn(),
      moveClass: jest.fn(),
      getCRSchedules: jest.fn(),
      deleteOverride: jest.fn(),
    },
    getAuthToken: jest.fn(),
    getCRUserMeta: jest.fn(),
    saveAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
  };
});

const mockGroupedRooms = {
  G_ROOMS: [
    {
      roomId: 'G09',
      roomName: 'G09 Classroom',
      category: 'G_ROOMS',
      status: 'OCCUPIED' as const,
      ongoingClass: {
        course: 'DSA',
        section: 1,
        batch: 'UG1',
        endTime: '09:45',
        isMovedIn: false,
      },
      nextClass: null,
      freeUntil: null,
      freeDurationMinutes: null,
      timeline: [],
    },
    {
      roomId: 'G04',
      roomName: 'G04 Classroom',
      category: 'G_ROOMS',
      status: 'FREE' as const,
      ongoingClass: null,
      nextClass: {
        course: 'WBD',
        section: 3,
        batch: 'UG3',
        startTime: '09:45',
        isMovedIn: false,
      },
      freeUntil: '09:45',
      freeDurationMinutes: 60,
      timeline: [],
    },
  ],
  B_ROOMS: [
    {
      roomId: 'B03',
      roomName: 'B03 Classroom',
      category: 'B_ROOMS',
      status: 'FREE' as const,
      ongoingClass: null,
      nextClass: null,
      freeUntil: null,
      freeDurationMinutes: 300,
      timeline: [],
    },
  ],
  FIRST_FLOOR: [
    {
      roomId: 'LAB-103',
      roomName: 'Room 103 (Lab)',
      category: 'FIRST_FLOOR',
      status: 'OCCUPIED' as const,
      ongoingClass: {
        course: 'CA',
        section: 4,
        batch: 'UG1',
        endTime: '12:00',
        isMovedIn: false,
      },
      nextClass: null,
      freeUntil: null,
      freeDurationMinutes: null,
      timeline: [],
    },
  ],
};

describe('Frontend Rendering Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getRooms as jest.Mock).mockResolvedValue({
      targetDate: '2026-05-25',
      targetTime: '08:50',
      groupedRooms: mockGroupedRooms,
    });
  });

  test('Homepage renders sections: G Rooms, B Rooms, First Floor', async () => {
    await act(async () => {
      render(<HomePage />);
    });

    // Wait for the rooms data to be fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('G Rooms')).toBeInTheDocument();
      expect(screen.getByText('B Rooms')).toBeInTheDocument();
      expect(screen.getByText('First Floor')).toBeInTheDocument();
    });
  });

  test('RoomCard displays correct room name, status, and class info', () => {
    // 1. Render an Occupied Room Card (G09)
    const occupiedRoom = mockGroupedRooms.G_ROOMS[0];
    const { rerender } = render(<RoomCard room={occupiedRoom} dateStr="2026-05-25" />);

    expect(screen.getByText('G09')).toBeInTheDocument();
    expect(screen.getByText('BUSY')).toBeInTheDocument();
    expect(screen.getByText('DSA1')).toBeInTheDocument();
    expect(screen.getByText('09:45')).toBeInTheDocument();

    // 2. Render a Free Room Card (G04)
    const freeRoom = mockGroupedRooms.G_ROOMS[1];
    rerender(<RoomCard room={freeRoom} dateStr="2026-05-25" />);

    expect(screen.getByText('G04')).toBeInTheDocument();
    expect(screen.getByText('FREE')).toBeInTheDocument();
    expect(screen.getByText('Free Now')).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
  });

  test('Clicking RoomCard navigates to correct room details URL', () => {
    const freeRoom = mockGroupedRooms.G_ROOMS[1];
    render(<RoomCard room={freeRoom} dateStr="2026-05-25" />);

    const linkElement = screen.getByRole('link');
    expect(linkElement).toHaveAttribute('href', '/room/G04?date=2026-05-25');
  });

  test('BottomNav renders navigation links correctly', () => {
    render(<BottomNav />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Free Now')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('CR Panel')).toBeInTheDocument();
  });

  test('CR Panel renders sign-in form for anonymous user', async () => {
    (getAuthToken as jest.Mock).mockReturnValue(null);
    (getCRUserMeta as jest.Mock).mockReturnValue(null);

    await act(async () => {
      render(<CRPanelPage />);
    });

    expect(screen.getByText('CR Sign In')).toBeInTheDocument();
    expect(screen.queryByText('Log Out')).not.toBeInTheDocument();
  });

  test('CR Panel renders control dashboard and authorized schedules for authenticated CR user', async () => {
    (getAuthToken as jest.Mock).mockReturnValue('mock-jwt-token');
    (getCRUserMeta as jest.Mock).mockReturnValue({
      id: 'cr-ug1-1-id',
      username: 'cr_ug1_1',
      name: 'UG1 Section 1 CR',
      batch: 'UG1',
      section: 1,
    });

    const mockCRSchedules = [
      {
        id: 'sched-1',
        batch: 'UG1',
        course: 'DSA',
        section: 1,
        roomName: 'G09',
        day: 'Monday',
        startTime: '08:45',
        endTime: '09:45',
        overrides: [],
      },
    ];

    (api.getCRSchedules as jest.Mock).mockResolvedValue({
      schedules: mockCRSchedules,
    });

    (api.getRooms as jest.Mock).mockResolvedValue({
      groupedRooms: mockGroupedRooms,
    });

    await act(async () => {
      render(<CRPanelPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('UG1 Section 1 CR')).toBeInTheDocument();
      expect(screen.getByText('Log Out')).toBeInTheDocument();
      expect(screen.getByText('DSA1')).toBeInTheDocument();
      // Should not contain unauthorized sections/schedules
      expect(screen.queryByText('FFSD2')).not.toBeInTheDocument();
    });
  });
});
