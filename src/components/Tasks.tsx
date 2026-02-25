import React, { useState } from 'react';

export default function Tasks() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Finalizar relatório mensal', completed: false, xp: 50 },
    { id: 2, title: 'Treino de pernas', completed: true, xp: 100 },
    { id: 3, title: 'Ler 20 páginas do livro', completed: false, xp: 30 },
  ]);

  const [newTask, setNewTask] = useState('');

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: newTask, completed: false, xp: 50 }]);
    setNewTask('');
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-12 pb-12">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
            SYSTEM ONLINE // MISSIONS
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            DAILY<br/><span className="text-surface-3">MISSIONS</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Gerenciamento de tarefas diárias. Complete missões para ganhar XP e subir de nível.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Active Missions</h2>
          <span className="text-xs text-text-muted ml-auto font-mono">
            // {tasks.filter(t => t.completed).length}/{tasks.length} COMPLETED
          </span>
        </div>

        <form onSubmit={addTask} className="flex gap-3 mb-8">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="ENTER NEW MISSION..."
            className="flex-1 bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase placeholder:text-text-muted/50"
          />
          <button type="submit" className="btn-primary">
            ADD MISSION +
          </button>
        </form>

        <div className="space-y-2">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center justify-between p-4 border transition-all ${
                task.completed 
                  ? 'bg-surface border-border-subtle opacity-50' 
                  : 'bg-surface-2 border-border-subtle hover:border-accent/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 border flex items-center justify-center transition-colors ${
                    task.completed ? 'bg-accent border-accent text-black' : 'border-border-subtle hover:border-accent'
                  }`}
                >
                  {task.completed && (
                    <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                      <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"/>
                    </svg>
                  )}
                </button>
                <span className={`text-sm font-medium uppercase tracking-[0.04em] ${task.completed ? 'line-through text-text-muted' : 'text-text-main'}`}>
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono font-bold text-accent border border-border-accent bg-accent/10 px-2 py-1">
                  +{task.xp} XP
                </span>
                <button onClick={() => deleteTask(task.id)} className="text-text-muted hover:text-error transition-colors text-[10px] font-mono uppercase tracking-[0.1em]">
                  [DEL]
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
