import {
  AppstoreOutlined,
  PlusOutlined,
  SettingOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageSize } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import { Avatar, message, Typography } from 'antd';

import { teamApi } from '@/api/teams';
import type { Team } from '@/types/api';

import './TeamSidebar.css';

const { Title } = Typography;

interface TeamSidebarProps {
  team: Team;
  onInvite?: () => void;
  onNavigateToSettings?: () => void;
}

/**
 * Team sidebar component
 * Shows team avatar, name, settings/registry links, and member list
 */
const TeamSidebar: React.FC<TeamSidebarProps> = ({
  team,
  onInvite,
  onNavigateToSettings,
}) => {
  // Fetch first few members for sidebar display
  const { data: membersData } = useQuery({
    queryKey: ['team', 'members', team.id, 1, 5],
    queryFn: () =>
      teamApi.getTeamMembers(team.id, {
        page: 1,
        size: PageSize.Small,
      }),
  });

  const members = membersData?.items || [];
  const totalMembers = membersData?.total || 0;
  const handleShare = () => {
    const url = `${window.location.origin}/${team.name}`;
    navigator.clipboard.writeText(url);
    message.success('Team URL copied to clipboard');
  };

  return (
    <div className='team-sidebar'>
      {/* Team Avatar */}
      <div className='team-sidebar-avatar'>
        {team.avatar_url ? (
          <img src={team.avatar_url} alt={team.display_name || team.name} />
        ) : (
          <div className='team-sidebar-avatar-placeholder'>
            <svg viewBox='0 0 100 100' fill='currentColor'>
              <circle cx='35' cy='35' r='15' />
              <circle cx='65' cy='35' r='15' />
              <circle cx='50' cy='70' r='15' />
              <path
                d='M35 50 Q35 60 50 60 Q65 60 65 50'
                strokeWidth='3'
                stroke='currentColor'
                fill='none'
              />
            </svg>
          </div>
        )}
      </div>

      {/* Team Name */}
      <div className='team-sidebar-name'>
        <Title
          level={5}
          style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}
        >
          {team.display_name || team.name}
        </Title>
        <ShareAltOutlined className='share-icon' onClick={handleShare} />
      </div>

      {/* Links */}
      <div className='team-sidebar-links'>
        <div
          className='team-sidebar-link'
          onClick={onNavigateToSettings}
          role='button'
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateToSettings?.()}
        >
          <SettingOutlined />
          <span>Team settings</span>
        </div>
        <div className='team-sidebar-link'>
          <AppstoreOutlined />
          <span>Registry</span>
        </div>
      </div>

      {/* Members Section */}
      <div className='team-sidebar-section'>
        <div className='team-sidebar-section-header'>
          <span className='team-sidebar-section-title'>
            MEMBERS ({totalMembers})
          </span>
        </div>
        <div
          className='team-sidebar-invite'
          onClick={onInvite}
          role='button'
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onInvite?.()}
        >
          <PlusOutlined />
          <span>Invite team members</span>
        </div>
        <div className='team-sidebar-members'>
          {members.map((member) => (
            <div key={member.user_id} className='team-sidebar-member'>
              <Avatar
                size={24}
                icon={<UserOutlined />}
                style={{ backgroundColor: 'var(--color-primary-500)' }}
              />
              <span className='team-sidebar-member-name'>
                {member.username}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamSidebar;
