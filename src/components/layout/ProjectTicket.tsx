import type { DragEvent, HTMLAttributes } from 'react';
import type { Project } from '../../types/entities';

interface Props {
  project: Project;
  active: boolean;
  dragEnabled: boolean;
  dragProps: HTMLAttributes<HTMLDivElement>;
  onClick: () => void;
}

export default function ProjectTicket({ project, active, dragEnabled, dragProps, onClick }: Props) {
  return (
    <div
      className={`ticket${active ? ' active' : ''}${dragProps.className ? ' ' + dragProps.className : ''}`}
      title={`${project.name} — ${project.kunde || '—'}${dragEnabled ? ' — ziehen zum Umsortieren' : ''}`}
      onClick={onClick}
      draggable={dragProps.draggable}
      onDragStart={dragProps.onDragStart as (e: DragEvent<HTMLDivElement>) => void}
      onDragEnd={dragProps.onDragEnd as (e: DragEvent<HTMLDivElement>) => void}
      onDragOver={dragProps.onDragOver as (e: DragEvent<HTMLDivElement>) => void}
      onDragLeave={dragProps.onDragLeave as (e: DragEvent<HTMLDivElement>) => void}
      onDrop={dragProps.onDrop as (e: DragEvent<HTMLDivElement>) => void}
    >
      <div className="ticket-perf" />
      <div className="ticket-body">
        <div className="ticket-top-row">
          <span className="ticket-name">{project.name}</span>
          <span className={`status-dot ${project.status}`} />
        </div>
      </div>
    </div>
  );
}
