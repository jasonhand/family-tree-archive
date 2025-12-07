# Lineage — Family Tree Archive

A modern, interactive web application for exploring and visualizing family history. Built with Svelte and designed for static deployment, this app provides rich genealogical data visualization and analysis tools.

## Features

### Core Functionality
- **Interactive Family Tree Visualization** - Ancestor fan chart with configurable generations
- **Person Cards** - Detailed views of each family member with biographical information
- **Advanced Search & Filtering** - Search by name, location, date ranges, and custom attributes
- **Relationship Finder** - Calculate and visualize relationships between any two family members

### Visualizations & Analytics
- **Geographic Mapping** - Interactive maps showing birth/death locations and migration patterns
- **Statistical Analysis** - Comprehensive family statistics including:
  - Lifespan evolution over time
  - Birth/death balance charts
  - Marriage age trends
  - Population growth visualization
  - Surname distribution
  - Geographic expansion patterns
- **Timeline Views**:
  - Memorial timeline of family deaths
  - Life overlap timeline showing concurrent lifespans
  - Family timeline with major life events
  - Immigration timeline
  - Marriage timeline
- **Sunburst Chart** - Hierarchical family structure visualization
- **Generation Heatmap** - Visual representation of family size by generation

### Personal Features
- **Favorites System** - Mark and filter favorite family members
- **Upcoming Birthdays** - Track upcoming birthdays and anniversaries
- **Historical Context** - View world history events alongside family timeline
- **Notes & Biography** - Rich biographical information for each person

## Technology Stack

- **Frontend Framework**: Svelte 4
- **Build Tool**: Vite 5
- **Mapping**: Leaflet.js with marker clustering
- **Styling**: Custom CSS with modern design system
- **Data Format**: JSON

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd family-tree-archive
```

2. Install dependencies:
```bash
npm install
```

3. Add your family data:
   - Place your `HandFamilyTree.json` file in the `public/` directory
   - The JSON file should contain an array of person objects with genealogical data

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

## Data Format

The application expects a JSON file (`HandFamilyTree.json`) in the `public/` directory with the following structure:

```json
[
  {
    "id": "unique-id",
    "name": "Full Name",
    "sex": "M|F",
    "birth_date": "Date string",
    "birth_year": 1900,
    "birth_place": "City, State, Country",
    "birth_city": "City",
    "birth_state": "State",
    "birth_country": "Country",
    "death_date": "Date string",
    "death_year": 1980,
    "death_place": "City, State, Country",
    "death_city": "City",
    "death_state": "State",
    "death_country": "Country",
    "child_family_id": "family-id",
    "spouse_family_ids": ["family-id"],
    "is_favorite": false,
    "is_flagged": false,
    "is_immigrant": false,
    "notes": "Biography and notes",
    "residences": [
      {
        "city": "City",
        "state": "State",
        "country": "Country"
      }
    ]
  }
]
```

## Contributing

This is a personal family history project. If you'd like to use it for your own family:

1. Fork the repository
2. Replace the data in `public/HandFamilyTree.json`
3. Customize the branding (title, colors, etc.)
4. Deploy to your preferred hosting service

## License

[Specify your license here]

## Acknowledgments

- Built with [Svelte](https://svelte.dev/)
- Maps powered by [Leaflet](https://leafletjs.com/)
- Fonts: Cormorant Garamond & Outfit from Google Fonts
